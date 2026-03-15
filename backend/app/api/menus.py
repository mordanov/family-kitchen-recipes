from typing import List
import json
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database import get_db
from app.models import Menu, MenuItem, MenuStatus, Recipe, StockItem, PreparedDish, AppSettings
from app.schemas import MenuCreate, MenuOut, MenuItemCreate, MenuItemUpdate
from app.auth import get_current_user

router = APIRouter()

DEFAULT_PRODUCT_SYNONYMS = {
    "картошка": "картофель",
    "картофеля": "картофель",
    "картофельный": "картофель",
    "помидоры": "помидор",
    "помидора": "помидор",
    "томат": "помидор",
    "томаты": "помидор",
    "баклажаны": "баклажан",
    "огурцы": "огурец",
    "моркови": "морковь",
    "яйца": "яйцо",
    "чеснока": "чеснок",
    "свекла": "свекла",
    "свеклы": "свекла",
}

DEFAULT_PHRASE_SYNONYMS = {
    "болгарский перец": "перец",
    "сладкий перец": "перец",
    "зеленый лук": "лук",
    "зеленый чеснок": "чеснок",
}

PRODUCT_SYNONYMS_KEY = "warehouse_product_synonyms"
PHRASE_SYNONYMS_KEY = "warehouse_phrase_synonyms"

UNIT_TOKENS = {
    "г", "гр", "грамм", "грамма", "граммов",
    "кг", "килограмм", "килограмма", "килограммов",
    "мл", "л", "литр", "литра", "литров",
    "шт", "штука", "штуки", "штук", "уп", "упак", "упаковка",
    "ст", "стл", "чл", "зубчик", "зубчика", "зубчиков", "пучок", "пучка", "пучков",
}

DESCRIPTOR_TOKENS = {
    "свежий", "свежая", "свежие", "замороженный", "замороженная", "замороженные",
    "красный", "красная", "зеленый", "зеленая", "белый", "белая",
}


def _canonical_product_token(token: str, product_synonyms: dict[str, str]) -> str:
    token = token.strip().lower().replace("ё", "е")
    return product_synonyms.get(token, token)


def _extract_product_key(
    line: str,
    product_synonyms: dict[str, str],
    phrase_synonyms: dict[str, str],
) -> str:
    text = line.strip().lower().replace("ё", "е")
    # Keep words/numbers, normalize separators.
    text = re.sub(r"[^\w\s]", " ", text).replace("-", " ")
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return ""

    for phrase, canonical in phrase_synonyms.items():
        if phrase in text:
            return canonical

    tokens = [t for t in text.split() if t]

    for token in tokens:
        if re.fullmatch(r"\d+(?:[\.,]\d+)?", token):
            continue
        if token in UNIT_TOKENS or token in DESCRIPTOR_TOKENS:
            continue
        return _canonical_product_token(token, product_synonyms)
    return ""


def _load_aliases(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}

    aliases: dict[str, str] = {}
    for k, v in data.items():
        if not isinstance(k, str) or not isinstance(v, str):
            continue
        key = k.strip().lower().replace("ё", "е")
        val = v.strip().lower().replace("ё", "е")
        if key and val:
            aliases[key] = val
    return aliases


async def _merged_synonyms(db: AsyncSession) -> tuple[dict[str, str], dict[str, str]]:
    result = await db.execute(
        select(AppSettings).where(AppSettings.key.in_([PRODUCT_SYNONYMS_KEY, PHRASE_SYNONYMS_KEY]))
    )
    rows = result.scalars().all()
    by_key = {row.key: row.value for row in rows}

    product = dict(DEFAULT_PRODUCT_SYNONYMS)
    product.update(_load_aliases(by_key.get(PRODUCT_SYNONYMS_KEY)))

    phrase = dict(DEFAULT_PHRASE_SYNONYMS)
    phrase.update(_load_aliases(by_key.get(PHRASE_SYNONYMS_KEY)))
    return product, phrase


@router.get("/", response_model=List[MenuOut])
async def list_menus(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .order_by(Menu.created_at.desc())
    )
    return result.scalars().all()


@router.get("/active", response_model=MenuOut)
async def get_active_menu(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.status == MenuStatus.active)
        .order_by(Menu.created_at.desc())
    )
    menu = result.scalars().first()
    if not menu:
        raise HTTPException(status_code=404, detail="No active menu")
    return menu


@router.post("/", response_model=MenuOut)
async def create_menu(data: MenuCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    # Check if active menu exists
    result = await db.execute(select(Menu).where(Menu.status == MenuStatus.active))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Уже есть активное меню. Закройте его перед созданием нового.")

    menu = Menu(title=data.title, weeks=data.weeks)
    db.add(menu)
    await db.commit()
    await db.refresh(menu)

    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu.id)
    )
    return result.scalar_one()


@router.get("/{menu_id}", response_model=MenuOut)
async def get_menu(menu_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
    )
    menu = result.scalar_one_or_none()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    return menu


@router.post("/{menu_id}/items", response_model=MenuOut)
async def add_menu_item(
    menu_id: int,
    data: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(Menu).where(Menu.id == menu_id))
    menu = result.scalar_one_or_none()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    if menu.status != MenuStatus.active:
        raise HTTPException(status_code=400, detail="Меню уже закрыто")

    recipe_result = await db.execute(select(Recipe).where(Recipe.id == data.recipe_id))
    if not recipe_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Get max position
    items_result = await db.execute(select(MenuItem).where(MenuItem.menu_id == menu_id))
    items = items_result.scalars().all()
    max_pos = max((i.position for i in items), default=-1)

    item = MenuItem(
        menu_id=menu_id,
        recipe_id=data.recipe_id,
        position=max_pos + 1,
        week_number=min(max(data.week_number, 1), menu.weeks),
        day_of_week=data.day_of_week,
        meal_type=data.meal_type,
        note=data.note,
    )
    db.add(item)
    await db.commit()

    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
    )
    return result.scalar_one()


@router.patch("/{menu_id}/items/{item_id}", response_model=MenuOut)
async def update_menu_item(
    menu_id: int,
    item_id: int,
    data: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.menu_id == menu_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if data.is_cooked is not None:
        item.is_cooked = data.is_cooked
    if data.note is not None:
        item.note = data.note
    if data.position is not None:
        item.position = data.position

    await db.commit()

    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
    )
    return result.scalar_one()


@router.delete("/{menu_id}/items/{item_id}", response_model=MenuOut)
async def remove_menu_item(
    menu_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.menu_id == menu_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()

    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
    )
    return result.scalar_one()


@router.post("/{menu_id}/close", response_model=MenuOut)
async def close_menu(menu_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
    )
    menu = result.scalar_one_or_none()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    menu.status = MenuStatus.closed
    menu.closed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(menu)

    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
    )
    return result.scalar_one()


@router.get("/{menu_id}/shopping-list")
async def get_shopping_list(menu_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.items).selectinload(MenuItem.recipe))
        .where(Menu.id == menu_id)
    )
    menu = result.scalar_one_or_none()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    product_synonyms, phrase_synonyms = await _merged_synonyms(db)

    stock_result = await db.execute(select(StockItem))
    stock_items = stock_result.scalars().all()
    stock_names = {
        key
        for s in stock_items
        for key in [_extract_product_key(s.name or "", product_synonyms, phrase_synonyms)]
        if key
    }

    prepared_result = await db.execute(
        select(PreparedDish).options(selectinload(PreparedDish.recipe))
    )
    prepared_items = prepared_result.scalars().all()
    prepared_by_recipe_id = {}
    for p in prepared_items:
        prepared_by_recipe_id[p.recipe_id] = prepared_by_recipe_id.get(p.recipe_id, 0.0) + float(p.servings)

    shopping = {}
    all_lines: list[str] = []
    for item in menu.items:
        if not item.is_cooked and item.recipe and item.recipe.shopping_list:
            recipe_title = item.recipe.title
            if recipe_title not in shopping:
                shopping[recipe_title] = item.recipe.shopping_list
            lines = [l.strip() for l in item.recipe.shopping_list.splitlines() if l.strip()]
            all_lines.extend(lines)

    # Deduplicate preserving order
    seen: set[str] = set()
    unique_lines: list[str] = []
    for line in all_lines:
        key = line.lower()
        if key not in seen:
            seen.add(key)
            unique_lines.append(line)

    in_stock_lines: list[str] = []
    to_buy_lines: list[str] = []
    for line in unique_lines:
        key = _extract_product_key(line, product_synonyms, phrase_synonyms)
        if key and key in stock_names:
            in_stock_lines.append(line)
        else:
            to_buy_lines.append(line)

    prepared_summary = [
        {
            "recipe_id": p.recipe_id,
            "recipe_title": p.recipe.title if p.recipe else "",
            "servings": float(p.servings),
            "note": p.note,
        }
        for p in prepared_items
    ]

    return {
        "menu_title": menu.title,
        "shopping_lists": shopping,
        "combined_list": "\n".join(unique_lines),
        "to_buy_list": "\n".join(to_buy_lines),
        "in_stock_list": "\n".join(in_stock_lines),
        "stock_items": [{"name": s.name, "quantity": s.quantity} for s in stock_items],
        "prepared_items": prepared_summary,
        "prepared_by_recipe_id": prepared_by_recipe_id,
    }
