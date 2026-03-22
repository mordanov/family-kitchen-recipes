import os
import uuid
from collections import defaultdict
from typing import List, Optional
from pydantic import ValidationError
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import aiofiles

from app.database import get_db
from app.models import Recipe, CookingMethod, FamilyMember
from app.schemas import RecipeOut, RecipeMemberFeedbackOut, RecipeCreate
from app.auth import get_current_user
from app.services.kbju import calculate_kbju

router = APIRouter()
UPLOAD_DIR = "/app/uploads"


async def _collect_feedback_by_recipe(db: AsyncSession):
    result = await db.execute(
        select(FamilyMember)
        .options(
            selectinload(FamilyMember.preferred_recipes),
            selectinload(FamilyMember.disliked_recipes),
        )
        .order_by(FamilyMember.name)
    )
    members = result.scalars().all()

    feedback_by_recipe = defaultdict(dict)

    for member in members:
        for recipe in member.preferred_recipes or []:
            feedback_by_recipe[recipe.id][member.id] = RecipeMemberFeedbackOut(
                member_id=member.id,
                member_name=member.name,
                member_color=member.color,
                status="preferred",
            )

        # If a recipe appears in both sets for one member, mark it as disliked.
        for recipe in member.disliked_recipes or []:
            feedback_by_recipe[recipe.id][member.id] = RecipeMemberFeedbackOut(
                member_id=member.id,
                member_name=member.name,
                member_color=member.color,
                status="disliked",
            )

    return {recipe_id: list(member_map.values()) for recipe_id, member_map in feedback_by_recipe.items()}


def _build_recipe_out(recipe: Recipe, feedback_by_recipe: dict[int, list[RecipeMemberFeedbackOut]]) -> RecipeOut:
    data = RecipeOut.model_validate(recipe)
    data.member_feedback = feedback_by_recipe.get(recipe.id, [])
    return data


def _validate_recipe_payload(payload: dict) -> RecipeCreate:
    try:
        return RecipeCreate.model_validate(payload)
    except ValidationError as exc:
        first_error = exc.errors()[0] if exc.errors() else None
        detail = first_error.get("msg") if first_error else "Некорректные данные рецепта"
        raise HTTPException(status_code=422, detail=detail) from exc


async def run_kbju_calculation(recipe_id: int, db_url: str):
    """Background task to calculate KBJU after recipe save. Retries up to 3 times."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    import logging
    logger = logging.getLogger(__name__)

    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    for attempt in range(3):
        try:
            async with session_factory() as session:
                result = await session.execute(select(Recipe).where(Recipe.id == recipe_id))
                recipe = result.scalar_one_or_none()
                if not recipe:
                    logger.warning(f"Recipe {recipe_id} not found for KBJU calculation")
                    break

                kbju = await calculate_kbju(
                    title=recipe.title,
                    ingredients=recipe.ingredients,
                    servings=recipe.servings,
                    cooking_method=recipe.cooking_method.value,
                    recipe_text=recipe.recipe,
                )
                if kbju:
                    recipe.calories = kbju["calories"]
                    recipe.proteins = kbju["proteins"]
                    recipe.fats = kbju["fats"]
                    recipe.carbs = kbju["carbs"]
                    recipe.kbju_calculated = True
                    await session.commit()
                    logger.info(f"KBJU calculated for recipe {recipe_id}: {kbju}")
                    break
                else:
                    logger.warning(f"KBJU calculation returned None for recipe {recipe_id}, attempt {attempt+1}")
                    if attempt < 2:
                        await asyncio.sleep(5 * (attempt + 1))
        except Exception as e:
            logger.error(f"Error in KBJU background task for recipe {recipe_id}: {e}")
            if attempt < 2:
                await asyncio.sleep(5)

    await engine.dispose()


@router.get("/", response_model=List[RecipeOut])
async def list_recipes(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
    search: Optional[str] = None,
):
    query = select(Recipe).order_by(Recipe.updated_at.desc())
    if search:
        query = query.where(Recipe.title.ilike(f"%{search}%"))
    result = await db.execute(query)
    recipes = result.scalars().all()
    feedback_by_recipe = await _collect_feedback_by_recipe(db)
    return [_build_recipe_out(recipe, feedback_by_recipe) for recipe in recipes]


@router.post("/", response_model=RecipeOut)
async def create_recipe(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    categories: List[str] = Form(...),
    ingredients: str = Form(default=""),
    recipe: str = Form(default=""),
    shopping_list: str = Form(default=""),
    cooking_method: CookingMethod = Form(default=CookingMethod.boiling),
    servings: int = Form(default=4),
    cooking_time_minutes: Optional[int] = Form(default=None),
    extra_info: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    image_path = None
    if image and image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        async with aiofiles.open(filepath, 'wb') as f:
            content = await image.read()
            await f.write(content)
        image_path = f"/uploads/{filename}"

    payload = _validate_recipe_payload(
        {
            "title": title,
            "categories": categories,
            "ingredients": ingredients,
            "recipe": recipe,
            "shopping_list": shopping_list,
            "cooking_method": cooking_method,
            "servings": servings,
            "cooking_time_minutes": cooking_time_minutes,
            "extra_info": extra_info,
        }
    )

    recipe = Recipe(
        title=payload.title,
        categories=payload.categories,
        ingredients=payload.ingredients,
        recipe=payload.recipe if payload.recipe else None,
        shopping_list=payload.shopping_list,
        cooking_method=payload.cooking_method,
        servings=payload.servings,
        cooking_time_minutes=payload.cooking_time_minutes,
        extra_info=payload.extra_info if payload.extra_info else None,
        image_path=image_path,
    )
    db.add(recipe)
    await db.commit()
    await db.refresh(recipe)

    from app.config import settings
    background_tasks.add_task(run_kbju_calculation, recipe.id, settings.DATABASE_URL)

    return _build_recipe_out(recipe, {})


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(recipe_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    feedback_by_recipe = await _collect_feedback_by_recipe(db)
    return _build_recipe_out(recipe, feedback_by_recipe)


@router.put("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: int,
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    categories: List[str] = Form(...),
    ingredients: str = Form(default=""),
    recipe: str = Form(default=""),
    shopping_list: str = Form(default=""),
    cooking_method: CookingMethod = Form(default=CookingMethod.boiling),
    servings: int = Form(default=4),
    cooking_time_minutes: Optional[int] = Form(default=None),
    extra_info: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    db_recipe = result.scalar_one_or_none()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if image and image.filename:
        # Delete old image
        if db_recipe.image_path:
            old_path = "/app" + db_recipe.image_path
            if os.path.exists(old_path):
                os.remove(old_path)
        ext = os.path.splitext(image.filename)[1].lower()
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        async with aiofiles.open(filepath, 'wb') as f:
            content = await image.read()
            await f.write(content)
        db_recipe.image_path = f"/uploads/{filename}"

    payload = _validate_recipe_payload(
        {
            "title": title,
            "categories": categories,
            "ingredients": ingredients,
            "recipe": recipe,
            "shopping_list": shopping_list,
            "cooking_method": cooking_method,
            "servings": servings,
            "cooking_time_minutes": cooking_time_minutes,
            "extra_info": extra_info,
        }
    )

    db_recipe.title = payload.title
    db_recipe.categories = payload.categories
    db_recipe.ingredients = payload.ingredients
    db_recipe.recipe = payload.recipe if payload.recipe else None
    db_recipe.shopping_list = payload.shopping_list
    db_recipe.cooking_method = payload.cooking_method
    db_recipe.servings = payload.servings
    db_recipe.cooking_time_minutes = payload.cooking_time_minutes
    db_recipe.extra_info = payload.extra_info if payload.extra_info else None
    db_recipe.kbju_calculated = False  # Reset, will recalculate

    await db.commit()
    await db.refresh(db_recipe)

    from app.config import settings
    background_tasks.add_task(run_kbju_calculation, db_recipe.id, settings.DATABASE_URL)

    feedback_by_recipe = await _collect_feedback_by_recipe(db)
    return _build_recipe_out(db_recipe, feedback_by_recipe)


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if recipe.image_path:
        old_path = "/app" + recipe.image_path
        if os.path.exists(old_path):
            os.remove(old_path)
    await db.delete(recipe)
    await db.commit()
    return {"ok": True}


@router.get("/{recipe_id}/kbju-status")
async def kbju_status(recipe_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Lightweight endpoint for polling KBJU calculation status."""
    result = await db.execute(
        select(Recipe.kbju_calculated, Recipe.calories, Recipe.proteins, Recipe.fats, Recipe.carbs)
        .where(Recipe.id == recipe_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {
        "kbju_calculated": row.kbju_calculated,
        "calories": row.calories,
        "proteins": row.proteins,
        "fats": row.fats,
        "carbs": row.carbs,
    }


@router.post("/{recipe_id}/recalculate")
async def recalculate_kbju(
    recipe_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    recipe.kbju_calculated = False
    await db.commit()
    from app.config import settings
    background_tasks.add_task(run_kbju_calculation, recipe.id, settings.DATABASE_URL)
    return {"ok": True, "message": "КБЖУ пересчитывается..."}
