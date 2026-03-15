import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import aiofiles

from app.database import get_db
from app.models import FamilyMember, Recipe, Gender, DietModel
from app.schemas import FamilyMemberOut, FamilyMemberCreate, FamilyMemberUpdate
from app.auth import get_current_user
from datetime import date as date_type

router = APIRouter()
UPLOAD_DIR = "/app/uploads"


def _build_out(member: FamilyMember) -> FamilyMemberOut:
    return FamilyMemberOut(
        id=member.id,
        name=member.name,
        weight=member.weight,
        birth_date=member.birth_date,
        gender=member.gender,
        diet_model=member.diet_model,
        photo_path=member.photo_path,
        color=member.color,
        preferred_recipe_ids=[r.id for r in (member.preferred_recipes or [])],
        disliked_recipe_ids=[r.id for r in (member.disliked_recipes or [])],
        created_at=member.created_at,
        updated_at=member.updated_at,
    )


async def _save_photo(photo: UploadFile) -> str:
    ext = os.path.splitext(photo.filename)[1].lower() or ".jpg"
    filename = f"member_{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    async with aiofiles.open(filepath, "wb") as f:
        content = await photo.read()
        await f.write(content)
    return f"/uploads/{filename}"


@router.get("/", response_model=List[FamilyMemberOut])
async def list_members(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(FamilyMember).order_by(FamilyMember.name))
    members = result.scalars().all()
    return [_build_out(m) for m in members]


@router.post("/", response_model=FamilyMemberOut)
async def create_member(
    name: str = Form(...),
    weight: Optional[float] = Form(default=None),
    birth_date: Optional[date_type] = Form(default=None),
    gender: Optional[Gender] = Form(default=None),
    diet_model: Optional[DietModel] = Form(default=DietModel.weight_maintain),
    color: str = Form(default="#FF6B35"),
    photo: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    photo_path = None
    if photo and photo.filename:
        photo_path = await _save_photo(photo)

    member = FamilyMember(
        name=name,
        weight=weight,
        birth_date=birth_date,
        gender=gender,
        diet_model=diet_model,
        color=color,
        photo_path=photo_path,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return _build_out(member)


@router.get("/{member_id}", response_model=FamilyMemberOut)
async def get_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(FamilyMember).where(FamilyMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Член семьи не найден")
    return _build_out(member)


@router.put("/{member_id}", response_model=FamilyMemberOut)
async def update_member(
    member_id: int,
    name: Optional[str] = Form(default=None),
    weight: Optional[float] = Form(default=None),
    birth_date: Optional[date_type] = Form(default=None),
    gender: Optional[Gender] = Form(default=None),
    diet_model: Optional[DietModel] = Form(default=None),
    color: Optional[str] = Form(default=None),
    remove_photo: Optional[str] = Form(default=None),
    photo: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(FamilyMember).where(FamilyMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Член семьи не найден")

    if name is not None:
        member.name = name
    if weight is not None:
        member.weight = weight
    if birth_date is not None:
        member.birth_date = birth_date
    if gender is not None:
        member.gender = gender
    if diet_model is not None:
        member.diet_model = diet_model
    if color is not None:
        member.color = color

    if remove_photo == "1" and member.photo_path:
        old = os.path.join(UPLOAD_DIR, os.path.basename(member.photo_path))
        if os.path.exists(old):
            os.remove(old)
        member.photo_path = None

    if photo and photo.filename:
        if member.photo_path:
            old = os.path.join(UPLOAD_DIR, os.path.basename(member.photo_path))
            if os.path.exists(old):
                os.remove(old)
        member.photo_path = await _save_photo(photo)

    await db.commit()
    await db.refresh(member)
    return _build_out(member)


@router.delete("/{member_id}")
async def delete_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(FamilyMember).where(FamilyMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Член семьи не найден")
    if member.photo_path:
        old = os.path.join(UPLOAD_DIR, os.path.basename(member.photo_path))
        if os.path.exists(old):
            os.remove(old)
    await db.delete(member)
    await db.commit()
    return {"ok": True}


# ─── Preferred recipes ───

@router.post("/{member_id}/preferred/{recipe_id}", response_model=FamilyMemberOut)
async def add_preferred(
    member_id: int,
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    member = (await db.execute(select(FamilyMember).where(FamilyMember.id == member_id))).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Член семьи не найден")
    recipe = (await db.execute(select(Recipe).where(Recipe.id == recipe_id))).scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Рецепт не найден")
    if recipe not in member.preferred_recipes:
        member.preferred_recipes.append(recipe)
        await db.commit()
        await db.refresh(member)
    return _build_out(member)


@router.delete("/{member_id}/preferred/{recipe_id}", response_model=FamilyMemberOut)
async def remove_preferred(
    member_id: int,
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    member = (await db.execute(select(FamilyMember).where(FamilyMember.id == member_id))).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Член семьи не найден")
    member.preferred_recipes = [r for r in member.preferred_recipes if r.id != recipe_id]
    await db.commit()
    await db.refresh(member)
    return _build_out(member)


# ─── Disliked recipes ───

@router.post("/{member_id}/disliked/{recipe_id}", response_model=FamilyMemberOut)
async def add_disliked(
    member_id: int,
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    member = (await db.execute(select(FamilyMember).where(FamilyMember.id == member_id))).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Член семьи не найден")
    recipe = (await db.execute(select(Recipe).where(Recipe.id == recipe_id))).scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Рецепт не найден")
    if recipe not in member.disliked_recipes:
        member.disliked_recipes.append(recipe)
        await db.commit()
        await db.refresh(member)
    return _build_out(member)


@router.delete("/{member_id}/disliked/{recipe_id}", response_model=FamilyMemberOut)
async def remove_disliked(
    member_id: int,
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    member = (await db.execute(select(FamilyMember).where(FamilyMember.id == member_id))).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Член семьи не найден")
    member.disliked_recipes = [r for r in member.disliked_recipes if r.id != recipe_id]
    await db.commit()
    await db.refresh(member)
    return _build_out(member)

