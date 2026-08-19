import asyncio
import ipaddress
import os
import socket
import uuid
from collections import defaultdict
from typing import List, Optional
from urllib.parse import urlparse
from pydantic import BaseModel, ValidationError
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import aiofiles

from app.database import get_db
from app.models import Recipe, RecipeCategory, CookingMethodDirectory, FamilyMember
from app.schemas import RecipeOut, RecipeMemberFeedbackOut, RecipeCreate
from app.auth import get_current_user
from app.services.kbju import calculate_kbju

router = APIRouter()
UPLOAD_DIR = "/app/uploads"
DOCUMENTS_DIR = "/app/documents"


def _validate_pdf_upload(material: UploadFile) -> None:
    if not material.filename or not material.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Дополнительный материал должен быть PDF-файлом")

    content_type = (material.content_type or "").lower()
    allowed_types = {"", "application/pdf", "application/x-pdf", "binary/octet-stream", "application/octet-stream"}
    if content_type not in allowed_types:
        raise HTTPException(status_code=422, detail="Дополнительный материал должен быть PDF-файлом")


def _normalize_original_material_name(filename: Optional[str]) -> str:
    cleaned = os.path.basename((filename or "").strip())
    if not cleaned:
        return "material.pdf"
    return cleaned[:255]


def _remove_additional_material_file(material_path: Optional[str]) -> None:
    if not material_path:
        return
    old_material_path = "/app" + material_path
    if os.path.exists(old_material_path):
        os.remove(old_material_path)


async def _save_pdf_upload(material: UploadFile) -> tuple[str, str]:
    _validate_pdf_upload(material)
    original_name = _normalize_original_material_name(material.filename)
    filename = f"{uuid.uuid4()}.pdf"
    filepath = os.path.join(DOCUMENTS_DIR, filename)
    os.makedirs(DOCUMENTS_DIR, exist_ok=True)
    async with aiofiles.open(filepath, "wb") as f:
        content = await material.read()
        await f.write(content)
    return f"/documents/{filename}", original_name


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


async def _resolve_categories(db: AsyncSession, category_ids: List[int]) -> List[RecipeCategory]:
    if not category_ids:
        raise HTTPException(status_code=422, detail="Нужно выбрать минимум одну категорию")
    result = await db.execute(
        select(RecipeCategory).where(
            RecipeCategory.id.in_(category_ids),
            RecipeCategory.is_deleted == False,
        )
    )
    categories = result.scalars().all()
    if not categories:
        raise HTTPException(status_code=422, detail="Указанные категории не найдены")
    return list(categories)


async def _resolve_cooking_method(db: AsyncSession, method_id: Optional[int]) -> Optional[CookingMethodDirectory]:
    if not method_id:
        return None
    result = await db.execute(
        select(CookingMethodDirectory).where(
            CookingMethodDirectory.id == method_id,
            CookingMethodDirectory.is_deleted == False,
        )
    )
    method = result.scalar_one_or_none()
    if not method:
        raise HTTPException(status_code=422, detail="Способ приготовления не найден")
    return method


class ImageFromUrlRequest(BaseModel):
    url: str


async def _download_image_from_url(url: str) -> str:
    """Download an image from a URL, save to UPLOAD_DIR, return /uploads/<filename> path."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=422, detail="Поддерживаются только HTTP/HTTPS URL")
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=422, detail="Некорректный URL")

    try:
        resolved = await asyncio.to_thread(socket.gethostbyname, hostname)
        ip = ipaddress.ip_address(resolved)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(status_code=422, detail="Недопустимый URL")
    except (socket.gaierror, ValueError):
        raise HTTPException(status_code=422, detail="Не удалось разрешить хост")

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Не удалось загрузить изображение") from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Не удалось загрузить изображение")

    content_type = resp.headers.get("content-type", "").lower().split(";")[0].strip()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="URL не является изображением")

    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    ext = ext_map.get(content_type, ".jpg")

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(resp.content)

    return f"/uploads/{filename}"


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

                method_name = recipe.cooking_method.name if recipe.cooking_method else "другое"
                kbju = await calculate_kbju(
                    title=recipe.title,
                    ingredients=recipe.ingredients,
                    servings=recipe.servings,
                    cooking_method=method_name,
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
    categories: List[int] = Form(...),
    ingredients: str = Form(default=""),
    recipe: str = Form(default=""),
    shopping_list: str = Form(default=""),
    cooking_method: Optional[int] = Form(default=None),
    servings: int = Form(default=4),
    cooking_time_minutes: Optional[int] = Form(default=None),
    active_cooking_time_minutes: Optional[int] = Form(default=None),
    freezer_friendly: bool = Form(default=False),
    is_dietary: bool = Form(default=False),
    extra_info: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
    image_url: Optional[str] = Form(default=None),
    additional_material: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    category_objs = await _resolve_categories(db, categories)
    method_obj = await _resolve_cooking_method(db, cooking_method)

    image_path = None
    additional_material_path = None
    additional_material_original_name = None
    if image and image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        async with aiofiles.open(filepath, 'wb') as f:
            content = await image.read()
            await f.write(content)
        image_path = f"/uploads/{filename}"
    elif isinstance(image_url, str) and image_url:
        image_path = await _download_image_from_url(image_url)

    if additional_material and hasattr(additional_material, "filename") and additional_material.filename:
        additional_material_path, additional_material_original_name = await _save_pdf_upload(additional_material)

    payload = _validate_recipe_payload(
        {
            "title": title,
            "ingredients": ingredients,
            "recipe": recipe,
            "shopping_list": shopping_list,
            "servings": servings,
            "cooking_time_minutes": cooking_time_minutes,
            "active_cooking_time_minutes": active_cooking_time_minutes,
            "freezer_friendly": freezer_friendly,
            "is_dietary": is_dietary,
            "extra_info": extra_info,
        }
    )

    recipe_obj = Recipe(
        title=payload.title,
        categories=category_objs,
        ingredients=payload.ingredients,
        recipe=payload.recipe if payload.recipe else None,
        shopping_list=payload.shopping_list,
        cooking_method=method_obj,
        servings=payload.servings,
        cooking_time_minutes=payload.cooking_time_minutes,
        active_cooking_time_minutes=payload.active_cooking_time_minutes,
        freezer_friendly=payload.freezer_friendly,
        is_dietary=payload.is_dietary,
        additional_material_path=additional_material_path,
        additional_material_original_name=additional_material_original_name,
        extra_info=payload.extra_info if payload.extra_info else None,
        image_path=image_path,
    )
    db.add(recipe_obj)
    await db.commit()
    await db.refresh(recipe_obj)

    from app.config import settings
    background_tasks.add_task(run_kbju_calculation, recipe_obj.id, settings.DATABASE_URL)

    return _build_recipe_out(recipe_obj, {})


@router.post("/ocr")
async def ocr_recipe(
    images: List[UploadFile] = File(...),
    _=Depends(get_current_user),
):
    """
    Accept 1–10 recipe images, run OpenAI vision OCR, return parsed recipe fields.
    Does NOT save anything to the database.
    """
    from app.services.recipe_ocr import parse_recipe_images

    if not images or len(images) > 10:
        raise HTTPException(status_code=422, detail="Нужно от 1 до 10 изображений")

    image_data: list[tuple[bytes, str]] = []
    for upload in images:
        content = await upload.read()
        ct = (upload.content_type or "image/jpeg").lower()
        if not ct.startswith("image/"):
            raise HTTPException(status_code=422, detail=f"Файл {upload.filename!r} не является изображением")
        image_data.append((content, ct))

    try:
        result = await parse_recipe_images(image_data)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return result


@router.get("/image-search")
async def search_images(q: str, _=Depends(get_current_user)):
    from app.config import settings
    if not settings.UNSPLASH_API_KEY:
        raise HTTPException(status_code=503, detail="Поиск изображений не настроен")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": q, "per_page": 4, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {settings.UNSPLASH_API_KEY}"},
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Ошибка сервиса поиска") from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Ошибка сервиса поиска изображений")

    return [
        {
            "url": item["urls"]["regular"],
            "thumbnail": item["urls"]["small"],
            "title": item.get("alt_description") or item.get("description") or "",
        }
        for item in resp.json().get("results", [])
    ]


@router.post("/{recipe_id}/image-from-url", response_model=RecipeOut)
async def image_from_url(
    recipe_id: int,
    body: ImageFromUrlRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if recipe.image_path:
        old_path = "/app" + recipe.image_path
        if os.path.exists(old_path):
            os.remove(old_path)

    recipe.image_path = await _download_image_from_url(body.url)
    await db.commit()
    await db.refresh(recipe)

    feedback_by_recipe = await _collect_feedback_by_recipe(db)
    return _build_recipe_out(recipe, feedback_by_recipe)


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
    categories: List[int] = Form(...),
    ingredients: str = Form(default=""),
    recipe: str = Form(default=""),
    shopping_list: str = Form(default=""),
    cooking_method: Optional[int] = Form(default=None),
    servings: int = Form(default=4),
    cooking_time_minutes: Optional[int] = Form(default=None),
    active_cooking_time_minutes: Optional[int] = Form(default=None),
    freezer_friendly: bool = Form(default=False),
    is_dietary: bool = Form(default=False),
    extra_info: str = Form(default=""),
    image: Optional[UploadFile] = File(default=None),
    image_url: Optional[str] = Form(default=None),
    remove_image: str = Form(default=""),
    additional_material: Optional[UploadFile] = File(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    db_recipe = result.scalar_one_or_none()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    category_objs = await _resolve_categories(db, categories)
    method_obj = await _resolve_cooking_method(db, cooking_method)

    if image and image.filename:
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
    elif isinstance(image_url, str) and image_url:
        if db_recipe.image_path:
            old_path = "/app" + db_recipe.image_path
            if os.path.exists(old_path):
                os.remove(old_path)
        db_recipe.image_path = await _download_image_from_url(image_url)
    elif remove_image == "true" and db_recipe.image_path:
        old_path = "/app" + db_recipe.image_path
        if os.path.exists(old_path):
            os.remove(old_path)
        db_recipe.image_path = None

    if additional_material and hasattr(additional_material, "filename") and additional_material.filename:
        _remove_additional_material_file(db_recipe.additional_material_path)
        (
            db_recipe.additional_material_path,
            db_recipe.additional_material_original_name,
        ) = await _save_pdf_upload(additional_material)

    payload = _validate_recipe_payload(
        {
            "title": title,
            "ingredients": ingredients,
            "recipe": recipe,
            "shopping_list": shopping_list,
            "servings": servings,
            "cooking_time_minutes": cooking_time_minutes,
            "active_cooking_time_minutes": active_cooking_time_minutes,
            "freezer_friendly": freezer_friendly,
            "is_dietary": is_dietary,
            "extra_info": extra_info,
        }
    )

    db_recipe.title = payload.title
    db_recipe.categories = category_objs
    db_recipe.ingredients = payload.ingredients
    db_recipe.recipe = payload.recipe if payload.recipe else None
    db_recipe.shopping_list = payload.shopping_list
    db_recipe.cooking_method = method_obj
    db_recipe.servings = payload.servings
    db_recipe.cooking_time_minutes = payload.cooking_time_minutes
    db_recipe.active_cooking_time_minutes = payload.active_cooking_time_minutes
    db_recipe.freezer_friendly = payload.freezer_friendly
    db_recipe.is_dietary = payload.is_dietary
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
    _remove_additional_material_file(recipe.additional_material_path)
    await db.delete(recipe)
    await db.commit()
    return {"ok": True}


@router.delete("/{recipe_id}/additional-material", response_model=RecipeOut)
async def delete_additional_material(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    _remove_additional_material_file(recipe.additional_material_path)
    recipe.additional_material_path = None
    recipe.additional_material_original_name = None
    await db.commit()
    await db.refresh(recipe)

    feedback_by_recipe = await _collect_feedback_by_recipe(db)
    return _build_recipe_out(recipe, feedback_by_recipe)


@router.get("/{recipe_id}/additional-material/download")
async def download_additional_material(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not recipe.additional_material_path:
        raise HTTPException(status_code=404, detail="Дополнительный материал не найден")

    file_path = "/app" + recipe.additional_material_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Дополнительный материал не найден")

    download_name = _normalize_original_material_name(recipe.additional_material_original_name)
    return FileResponse(file_path, media_type="application/pdf", filename=download_name)


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
