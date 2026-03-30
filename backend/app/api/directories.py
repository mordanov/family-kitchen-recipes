"""
CRUD endpoints for editable directories: recipe categories and cooking methods.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import RecipeCategory, CookingMethodDirectory
from app.auth import get_current_user
from app.schemas import (
    RecipeCategoryOut, RecipeCategoryCreate, RecipeCategoryUpdate,
    CookingMethodOut, CookingMethodCreate, CookingMethodUpdate,
)

router = APIRouter()


# ── Recipe Categories ──────────────────────────────────────────────────────────

@router.get("/recipe-categories", response_model=list[RecipeCategoryOut])
async def list_recipe_categories(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(RecipeCategory)
        .where(RecipeCategory.is_deleted == False)
        .order_by(RecipeCategory.name)
    )
    return result.scalars().all()


@router.post("/recipe-categories", response_model=RecipeCategoryOut, status_code=201)
async def create_recipe_category(
    data: RecipeCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    existing = await db.execute(
        select(RecipeCategory).where(RecipeCategory.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Категория с таким именем уже существует")
    category = RecipeCategory(name=data.name)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/recipe-categories/{category_id}", response_model=RecipeCategoryOut)
async def update_recipe_category(
    category_id: int,
    data: RecipeCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(RecipeCategory).where(RecipeCategory.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    if data.name != category.name:
        dup = await db.execute(
            select(RecipeCategory).where(
                RecipeCategory.name == data.name,
                RecipeCategory.id != category_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Категория с таким именем уже существует")
    category.name = data.name
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/recipe-categories/{category_id}", status_code=204)
async def delete_recipe_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(RecipeCategory).where(RecipeCategory.id == category_id)
    )
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    category.is_deleted = True
    await db.commit()


# ── Cooking Methods ────────────────────────────────────────────────────────────

@router.get("/cooking-methods", response_model=list[CookingMethodOut])
async def list_cooking_methods(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(CookingMethodDirectory)
        .where(CookingMethodDirectory.is_deleted == False)
        .order_by(CookingMethodDirectory.name)
    )
    return result.scalars().all()


@router.post("/cooking-methods", response_model=CookingMethodOut, status_code=201)
async def create_cooking_method(
    data: CookingMethodCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    existing = await db.execute(
        select(CookingMethodDirectory).where(CookingMethodDirectory.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Способ приготовления с таким именем уже существует")
    method = CookingMethodDirectory(name=data.name, emoji=data.emoji)
    db.add(method)
    await db.commit()
    await db.refresh(method)
    return method


@router.put("/cooking-methods/{method_id}", response_model=CookingMethodOut)
async def update_cooking_method(
    method_id: int,
    data: CookingMethodUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(CookingMethodDirectory).where(CookingMethodDirectory.id == method_id)
    )
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(status_code=404, detail="Способ приготовления не найден")
    if data.name is not None and data.name != method.name:
        dup = await db.execute(
            select(CookingMethodDirectory).where(
                CookingMethodDirectory.name == data.name,
                CookingMethodDirectory.id != method_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Способ приготовления с таким именем уже существует")
        method.name = data.name
    if data.emoji is not None:
        method.emoji = data.emoji or None
    await db.commit()
    await db.refresh(method)
    return method


@router.delete("/cooking-methods/{method_id}", status_code=204)
async def delete_cooking_method(
    method_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(CookingMethodDirectory).where(CookingMethodDirectory.id == method_id)
    )
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(status_code=404, detail="Способ приготовления не найден")
    method.is_deleted = True
    await db.commit()
