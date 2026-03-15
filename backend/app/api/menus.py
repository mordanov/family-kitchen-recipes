from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database import get_db
from app.models import Menu, MenuItem, MenuStatus, Recipe
from app.schemas import MenuCreate, MenuOut, MenuItemCreate, MenuItemUpdate
from app.auth import get_current_user

router = APIRouter()


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

    shopping = {}
    for item in menu.items:
        if not item.is_cooked and item.recipe and item.recipe.shopping_list:
            recipe_title = item.recipe.title
            if recipe_title not in shopping:
                shopping[recipe_title] = item.recipe.shopping_list

    return {"menu_title": menu.title, "shopping_lists": shopping}
