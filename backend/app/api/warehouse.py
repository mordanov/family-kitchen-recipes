from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import StockItem, PreparedDish
from app.schemas import (
    StockItemCreate, StockItemUpdate, StockItemOut,
    PreparedDishCreate, PreparedDishUpdate, PreparedDishOut,
)
from app.auth import get_current_user

router = APIRouter()


# ── Stock Items (В наличии) ──────────────────────────────────────────────────

@router.get("/items", response_model=List[StockItemOut])
async def list_stock(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(StockItem).order_by(StockItem.name))
    return result.scalars().all()


@router.post("/items", response_model=StockItemOut)
async def create_stock_item(
    data: StockItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    item = StockItem(name=data.name, quantity=data.quantity, added_on=data.added_on)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=StockItemOut)
async def update_stock_item(
    item_id: int,
    data: StockItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(StockItem).where(StockItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    if data.name is not None:
        item.name = data.name
    if data.quantity is not None:
        item.quantity = data.quantity
    if data.added_on is not None:
        item.added_on = data.added_on
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}")
async def delete_stock_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(StockItem).where(StockItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Stock item not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}


# ── Prepared Dishes (Заготовки) ───────────────────────────────────────────────

@router.get("/prepared", response_model=List[PreparedDishOut])
async def list_prepared(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(PreparedDish)
        .options(selectinload(PreparedDish.recipe))
        .order_by(PreparedDish.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/prepared", response_model=PreparedDishOut)
async def create_prepared(
    data: PreparedDishCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    dish = PreparedDish(
        recipe_id=data.recipe_id,
        servings=data.servings,
        note=data.note,
        added_on=data.added_on,
    )
    db.add(dish)
    await db.commit()
    result = await db.execute(
        select(PreparedDish)
        .options(selectinload(PreparedDish.recipe))
        .where(PreparedDish.id == dish.id)
    )
    return result.scalar_one()


@router.patch("/prepared/{dish_id}", response_model=PreparedDishOut)
async def update_prepared(
    dish_id: int,
    data: PreparedDishUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(PreparedDish)
        .options(selectinload(PreparedDish.recipe))
        .where(PreparedDish.id == dish_id)
    )
    dish = result.scalar_one_or_none()
    if not dish:
        raise HTTPException(status_code=404, detail="Prepared dish not found")
    if data.recipe_id is not None:
        dish.recipe_id = data.recipe_id
    if data.servings is not None:
        dish.servings = data.servings
    if data.note is not None:
        dish.note = data.note
    if data.added_on is not None:
        dish.added_on = data.added_on
    await db.commit()
    await db.refresh(dish)
    result = await db.execute(
        select(PreparedDish)
        .options(selectinload(PreparedDish.recipe))
        .where(PreparedDish.id == dish_id)
    )
    return result.scalar_one()


@router.delete("/prepared/{dish_id}")
async def delete_prepared(
    dish_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(PreparedDish).where(PreparedDish.id == dish_id))
    dish = result.scalar_one_or_none()
    if not dish:
        raise HTTPException(status_code=404, detail="Prepared dish not found")
    await db.delete(dish)
    await db.commit()
    return {"ok": True}
