from typing import List
import json
import re
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database import get_db
from app.models import Menu, MenuItem, MenuItemMember, MenuStatus, Recipe, StockItem, PreparedDish, AppSettings, FamilyMember
from app.schemas import MenuCreate, MenuOut, MenuItemCreate, MenuItemUpdate, AutoFillRequest, MemberAssignmentCreate
from app.auth import get_current_user

router = APIRouter()

ALLOWED_MEAL_TYPES = {"breakfast", "lunch", "dinner"}


def _validate_day_and_meal(day_of_week: int | None, meal_type: str | None) -> None:
    if day_of_week is not None and not (1 <= day_of_week <= 7):
        raise HTTPException(status_code=400, detail="day_of_week должен быть от 1 до 7")
    if meal_type is not None and meal_type not in ALLOWED_MEAL_TYPES:
        raise HTTPException(status_code=400, detail="meal_type должен быть breakfast/lunch/dinner")


def _ensure_unique_member_assignments(assignments: List[MemberAssignmentCreate]) -> None:
    seen: set[int] = set()
    for asn in assignments:
        if asn.member_id in seen:
            raise HTTPException(status_code=400, detail="Дублирующиеся member_id в назначениях")
        seen.add(asn.member_id)


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


def _menu_options():
    """Reusable eager-load chain for Menu queries."""
    return [
        selectinload(Menu.items).selectinload(MenuItem.recipe),
        selectinload(Menu.items)
            .selectinload(MenuItem.member_assignments)
            .selectinload(MenuItemMember.recipe),
        selectinload(Menu.items)
            .selectinload(MenuItem.member_assignments)
            .selectinload(MenuItemMember.member),
    ]


@router.get("/", response_model=List[MenuOut])
async def list_menus(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu)
        .options(*_menu_options())
        .order_by(Menu.created_at.desc())
    )
    return result.scalars().all()


@router.get("/active", response_model=MenuOut)
async def get_active_menu(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu)
        .options(*_menu_options())
        .where(Menu.status == MenuStatus.active)
        .order_by(Menu.created_at.desc())
    )
    menu = result.scalars().first()
    if not menu:
        raise HTTPException(status_code=404, detail="No active menu")
    return menu


@router.post("/", response_model=MenuOut)
async def create_menu(data: MenuCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Menu).where(Menu.status == MenuStatus.active))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Уже есть активное меню. Закройте его перед созданием нового.")

    menu = Menu(title=data.title, weeks=data.weeks)
    db.add(menu)
    await db.commit()
    await db.refresh(menu)

    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu.id)
    )
    return result.scalar_one()


@router.get("/{menu_id}", response_model=MenuOut)
async def get_menu(menu_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
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

    _validate_day_and_meal(data.day_of_week, data.meal_type)
    _ensure_unique_member_assignments(data.member_assignments)

    if data.recipe_id is None and not data.member_assignments:
        raise HTTPException(status_code=400, detail="Нужно указать recipe_id или member_assignments")

    if data.recipe_id is not None:
        rr = await db.execute(select(Recipe).where(Recipe.id == data.recipe_id))
        if not rr.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Recipe not found")

    for asn in data.member_assignments:
        mr = await db.execute(select(FamilyMember).where(FamilyMember.id == asn.member_id))
        if not mr.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Member {asn.member_id} not found")
        rr = await db.execute(select(Recipe).where(Recipe.id == asn.recipe_id))
        if not rr.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Recipe {asn.recipe_id} not found")

    items_result = await db.execute(select(MenuItem).where(MenuItem.menu_id == menu_id))
    max_pos = max((i.position for i in items_result.scalars().all()), default=-1)

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
    await db.flush()

    for asn in data.member_assignments:
        db.add(MenuItemMember(menu_item_id=item.id, member_id=asn.member_id, recipe_id=asn.recipe_id))

    await db.commit()

    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
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

    _validate_day_and_meal(data.day_of_week, data.meal_type)

    if data.is_cooked is not None:
        item.is_cooked = data.is_cooked
    if data.note is not None:
        item.note = data.note
    if data.position is not None:
        item.position = data.position
    if data.meal_type is not None:
        item.meal_type = data.meal_type
    if data.day_of_week is not None:
        item.day_of_week = data.day_of_week

    await db.commit()

    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
    )
    return result.scalar_one()


@router.put("/{menu_id}/items/{item_id}/assignments", response_model=MenuOut)
async def set_item_assignments(
    menu_id: int,
    item_id: int,
    assignments: List[MemberAssignmentCreate],
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Replace all per-member recipe assignments for a menu slot."""
    result = await db.execute(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.menu_id == menu_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    _ensure_unique_member_assignments(assignments)

    existing = await db.execute(
        select(MenuItemMember).where(MenuItemMember.menu_item_id == item_id)
    )
    for a in existing.scalars().all():
        await db.delete(a)

    for asn in assignments:
        mr = await db.execute(select(FamilyMember).where(FamilyMember.id == asn.member_id))
        if not mr.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Member {asn.member_id} not found")
        rr = await db.execute(select(Recipe).where(Recipe.id == asn.recipe_id))
        if not rr.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Recipe {asn.recipe_id} not found")
        db.add(MenuItemMember(menu_item_id=item_id, member_id=asn.member_id, recipe_id=asn.recipe_id))

    await db.commit()

    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
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
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
    )
    return result.scalar_one()


@router.post("/{menu_id}/close", response_model=MenuOut)
async def close_menu(menu_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
    )
    menu = result.scalar_one_or_none()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    menu.status = MenuStatus.closed
    menu.closed_at = datetime.utcnow()
    await db.commit()

    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
    )
    return result.scalar_one()


@router.get("/{menu_id}/shopping-list")
async def get_shopping_list(menu_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
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
    # Collect recipes from both shared recipe_id and per-member assignments
    for item in menu.items:
        if item.is_cooked:
            continue
        recipes_to_include = []
        if item.recipe:
            recipes_to_include.append(item.recipe)
        for asn in item.member_assignments:
            if asn.recipe and asn.recipe not in recipes_to_include:
                recipes_to_include.append(asn.recipe)
        for recipe in recipes_to_include:
            if recipe.shopping_list:
                if recipe.title not in shopping:
                    shopping[recipe.title] = recipe.shopping_list
                lines = [l.strip() for l in recipe.shopping_list.splitlines() if l.strip()]
                all_lines.extend(lines)

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


@router.post("/{menu_id}/auto-fill")
async def auto_fill_menu(
    menu_id: int,
    data: AutoFillRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Automatically populate a menu.

    Two modes:
    - use_meal_slots=False (default): flat list, one recipe per slot.
    - use_meal_slots=True: structured slots (week × day × meal).
      Each slot gets per-member recipes when family members are configured
      and have distinct preferences; otherwise a single shared recipe.

    Priority algorithm per recipe (applies both to shared and per-member picks):
      T1: preferred by member (or anyone) AND has stock match
      T2: preferred by member (or anyone)
      T3: neutral (not disliked by anyone)
      T4: last resort

    Within each tier, recipes from the most-recent closed menu are pushed to the end.
    """
    # ── Load menu ──────────────────────────────────────────────────────────────
    result = await db.execute(
        select(Menu).options(*_menu_options()).where(Menu.id == menu_id)
    )
    menu = result.scalar_one_or_none()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    if menu.status != MenuStatus.active:
        raise HTTPException(status_code=400, detail="Меню уже закрыто")
    if menu.items:
        raise HTTPException(status_code=400, detail="Меню уже содержит блюда. Очистите его перед авто-подбором.")

    # ── Load recipes ───────────────────────────────────────────────────────────
    recipes_result = await db.execute(select(Recipe))
    all_recipes: list[Recipe] = list(recipes_result.scalars().all())
    if not all_recipes:
        raise HTTPException(status_code=400, detail="Нет рецептов для подбора")

    # ── Load family members ────────────────────────────────────────────────────
    members_result = await db.execute(
        select(FamilyMember).options(
            selectinload(FamilyMember.preferred_recipes),
            selectinload(FamilyMember.disliked_recipes),
        )
    )
    members: list[FamilyMember] = list(members_result.scalars().all())

    # Global preferred / disliked sets (union across all members)
    global_preferred_ids: set[int] = set()
    global_disliked_ids: set[int] = set()
    for m in members:
        for r in m.preferred_recipes:
            global_preferred_ids.add(r.id)
        for r in m.disliked_recipes:
            global_disliked_ids.add(r.id)
    global_actually_disliked = global_disliked_ids - global_preferred_ids

    # Per-member preferred / disliked
    member_preferred: dict[int, set[int]] = {m.id: {r.id for r in m.preferred_recipes} for m in members}
    member_disliked: dict[int, set[int]] = {m.id: {r.id for r in m.disliked_recipes} for m in members}

    # ── Load last closed menu for variety ─────────────────────────────────────
    recent_result = await db.execute(
        select(Menu)
        .options(
            selectinload(Menu.items),
            selectinload(Menu.items).selectinload(MenuItem.member_assignments),
        )
        .where(Menu.status == MenuStatus.closed)
        .order_by(Menu.closed_at.desc())
    )
    recent_menu = recent_result.scalars().first()
    recent_ids: set[int] = set()
    if recent_menu:
        for it in recent_menu.items:
            if it.recipe_id:
                recent_ids.add(it.recipe_id)
            for asn in it.member_assignments:
                if asn.recipe_id:
                    recent_ids.add(asn.recipe_id)

    _ = global_disliked_ids  # keep explicit naming in current algorithm

    # ── Build stock match set ──────────────────────────────────────────────────
    product_synonyms, phrase_synonyms = await _merged_synonyms(db)
    stock_result = await db.execute(select(StockItem))
    stock_keys: set[str] = set()
    for s in stock_result.scalars().all():
        key = _extract_product_key(s.name or "", product_synonyms, phrase_synonyms)
        if key:
            stock_keys.add(key)

    def has_stock_match(recipe: Recipe) -> bool:
        if not stock_keys:
            return False
        for line in (recipe.shopping_list or recipe.ingredients or "").splitlines():
            line = line.strip()
            if line:
                k = _extract_product_key(line, product_synonyms, phrase_synonyms)
                if k and k in stock_keys:
                    return True
        return False

    def build_pool(
        preferred_set: set[int],
        disliked_set: set[int],
        exclude: set[int] | None = None,
    ) -> list[Recipe]:
        actually_bad = disliked_set - preferred_set
        t1, t2, t3, t4 = [], [], [], []
        for r in all_recipes:
            if exclude and r.id in exclude:
                continue
            if r.id in preferred_set and has_stock_match(r):
                t1.append(r)
            elif r.id in preferred_set:
                t2.append(r)
            elif r.id not in actually_bad:
                t3.append(r)
            else:
                t4.append(r)

        def deprio(tier: list[Recipe]) -> list[Recipe]:
            fresh = [r for r in tier if r.id not in recent_ids]
            old = [r for r in tier if r.id in recent_ids]
            random.shuffle(fresh)
            random.shuffle(old)
            return fresh + old

        return deprio(t1) + deprio(t2) + deprio(t3) + deprio(t4)

    # Flat mode: previous behavior
    if not data.use_meal_slots:
        pool = build_pool(global_preferred_ids, global_disliked_ids)
        total_slots = menu.weeks * data.recipes_per_week
        selected = pool[:total_slots]

        added = 0
        for idx, recipe in enumerate(selected):
            week_number = (idx // data.recipes_per_week) + 1
            db.add(MenuItem(
                menu_id=menu_id,
                recipe_id=recipe.id,
                position=idx,
                week_number=week_number,
            ))
            added += 1

        await db.commit()
        result = await db.execute(select(Menu).options(*_menu_options()).where(Menu.id == menu_id))
        return {"added": added, "menu": MenuOut.model_validate(result.scalar_one())}

    # Meal-slot mode: week x day x meal, with per-member choices
    all_meals = ["breakfast", "lunch", "dinner"]
    all_days = list(range(1, 8))

    target_days = [d for d in (data.days or all_days) if 1 <= d <= 7]
    target_meals = [m for m in (data.meals or all_meals) if m in all_meals]
    if not target_days:
        target_days = all_days
    if not target_meals:
        target_meals = all_meals

    position = 0
    added = 0
    member_used: dict[int, set[int]] = {m.id: set() for m in members}
    shared_used: set[int] = set()

    for week in range(1, menu.weeks + 1):
        for day in target_days:
            for meal in target_meals:
                if members:
                    member_picks: dict[int, Recipe] = {}

                    for m in members:
                        pool = build_pool(
                            member_preferred.get(m.id, set()),
                            member_disliked.get(m.id, set()),
                            exclude=member_used[m.id],
                        )
                        pick = next((r for r in pool), None)
                        if pick:
                            member_picks[m.id] = pick
                            member_used[m.id].add(pick.id)

                    unique_recipe_ids = {r.id for r in member_picks.values()}
                    all_same = len(unique_recipe_ids) == 1 and len(member_picks) > 0

                    if all_same:
                        one_recipe = next(iter(member_picks.values()))
                        shared_used.add(one_recipe.id)
                        db.add(MenuItem(
                            menu_id=menu_id,
                            recipe_id=one_recipe.id,
                            position=position,
                            week_number=week,
                            day_of_week=day,
                            meal_type=meal,
                        ))
                        added += 1
                    elif member_picks:
                        slot = MenuItem(
                            menu_id=menu_id,
                            recipe_id=None,
                            position=position,
                            week_number=week,
                            day_of_week=day,
                            meal_type=meal,
                        )
                        db.add(slot)
                        await db.flush()
                        for member_id, recipe in member_picks.items():
                            db.add(MenuItemMember(
                                menu_item_id=slot.id,
                                member_id=member_id,
                                recipe_id=recipe.id,
                            ))
                        added += 1
                else:
                    pool = build_pool(global_preferred_ids, global_disliked_ids, exclude=shared_used)
                    pick = next((r for r in pool), None)
                    if pick:
                        shared_used.add(pick.id)
                        db.add(MenuItem(
                            menu_id=menu_id,
                            recipe_id=pick.id,
                            position=position,
                            week_number=week,
                            day_of_week=day,
                            meal_type=meal,
                        ))
                        added += 1

                position += 1

    await db.commit()
    result = await db.execute(select(Menu).options(*_menu_options()).where(Menu.id == menu_id))
    return {"added": added, "menu": MenuOut.model_validate(result.scalar_one())}
