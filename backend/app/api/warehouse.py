import json
import logging
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AppSettings, StockItem, PreparedDish, ReceiptDraft
from app.schemas import (
    StockItemCreate, StockItemUpdate, StockItemOut,
    PreparedDishCreate, PreparedDishUpdate, PreparedDishOut,
    ReceiptDraftOut, ReceiptDraftUpdate, ReceiptDraftCommit, ReceiptDraftResult,
)
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ── AppSettings keys ─────────────────────────────────────────────────────────

_PRODUCT_SYNONYMS_KEY = "warehouse_product_synonyms"
_PHRASE_SYNONYMS_KEY = "warehouse_phrase_synonyms"
_UNRESOLVED_KEY = "warehouse_unresolved_synonyms"

_MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_setting_value(db: AsyncSession, key: str) -> str | None:
    result = await db.execute(select(AppSettings).where(AppSettings.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else None


async def _set_setting_value(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(AppSettings).where(AppSettings.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(AppSettings(key=key, value=value))


def _load_synonyms(raw: str | None) -> dict[str, str]:
    """Return key→value synonym map (both already lower-cased strings)."""
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    result: dict[str, str] = {}
    for k, v in (data.items() if isinstance(data, dict) else []):
        if isinstance(k, str) and isinstance(v, str):
            result[k.strip().lower()] = v.strip().lower()
    return result


def _load_unresolved(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return [str(x) for x in data if isinstance(x, str)]


def _apply_synonyms(
    name: str,
    product_synonyms: dict[str, str],
    phrase_synonyms: dict[str, str],
) -> tuple[str, bool]:
    """
    Normalize *name* using the synonym dictionaries.
    Phrase synonyms are checked first (longest match wins), then single-word synonyms.

    Returns (normalized_name, is_unresolved).
    is_unresolved=True means the name was not found in any synonym entry.
    """
    name_lower = name.strip().lower()

    # 1. Phrase synonyms (sorted longest-first to prefer more-specific matches)
    for phrase in sorted(phrase_synonyms, key=len, reverse=True):
        if phrase in name_lower:
            return phrase_synonyms[phrase], False

    # 2. Exact product synonym
    if name_lower in product_synonyms:
        return product_synonyms[name_lower], False

    # 3. Not found – caller should mark as unresolved
    return name_lower, True


# ── Receipt Processing ───────────────────────────────────────────────────────

@router.post("/receipt", response_model=ReceiptDraftResult)
async def process_receipt(
    image: UploadFile = File(..., description="Photo of a store receipt (JPEG, PNG, WEBP – max 10 MB)"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Upload a store-receipt image.

    Pipeline:
      1. OpenAI gpt-4o-mini vision API → transcribes image + extracts structured
         product list (handles rotation, any language, barcodes automatically)
      2. Synonym lookup → normalise product names
         • If a product name has no synonym entry → register it as *unresolved*
           in the `warehouse_unresolved_synonyms` settings key.
      3. Save products as a ReceiptDraft (not directly to warehouse).
         The draft must be reviewed and committed via POST /drafts/{id}/commit.

    Protected by standard JWT Bearer auth – include the Authorization header.
    """
    # ── 1. Read & validate upload ─────────────────────────────────────────────
    raw_bytes = await image.read()
    if len(raw_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB).")

    content_type = (image.content_type or "").lower()
    if content_type and not any(t in content_type for t in ("image/", "application/octet-stream")):
        raise HTTPException(status_code=415, detail="Only image files are accepted.")

    # ── 2. Vision API: read image and extract products in one step ────────────
    from app.services.receipt_parser import parse_receipt_with_vision
    content_type = (image.content_type or "image/jpeg").lower()
    try:
        ocr_text, products = await parse_receipt_with_vision(raw_bytes, content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error(f"Vision receipt parsing error: {exc}")
        raise HTTPException(status_code=502, detail="Could not parse receipt via vision API.")

    if not products:
        draft = ReceiptDraft(ocr_text=ocr_text, items=[])
        db.add(draft)
        await db.commit()
        await db.refresh(draft)
        return ReceiptDraftResult(
            draft_id=draft.id,
            ocr_text=ocr_text,
            items_count=0,
            unresolved_synonyms=[],
        )

    # ── 4. Load synonym dictionaries ──────────────────────────────────────────
    product_synonyms = _load_synonyms(await _get_setting_value(db, _PRODUCT_SYNONYMS_KEY))
    phrase_synonyms = _load_synonyms(await _get_setting_value(db, _PHRASE_SYNONYMS_KEY))
    unresolved: list[str] = _load_unresolved(await _get_setting_value(db, _UNRESOLVED_KEY))
    newly_unresolved: list[str] = []

    # ── 5. Build draft items (synonym normalization, no DB writes to stock) ───
    draft_items: list[dict] = []

    for product in products:
        original_name = product["name"]
        quantity = product["quantity"]

        normalized, is_unresolved = _apply_synonyms(original_name, product_synonyms, phrase_synonyms)

        if is_unresolved and normalized not in unresolved:
            unresolved.append(normalized)
            newly_unresolved.append(normalized)

        draft_items.append({"name": normalized, "quantity": quantity})

    # ── 6. Persist unresolved list & draft ────────────────────────────────────
    if newly_unresolved:
        await _set_setting_value(db, _UNRESOLVED_KEY, json.dumps(unresolved, ensure_ascii=False))

    draft = ReceiptDraft(ocr_text=ocr_text, items=draft_items)
    db.add(draft)
    await db.commit()
    await db.refresh(draft)

    return ReceiptDraftResult(
        draft_id=draft.id,
        ocr_text=ocr_text,
        items_count=len(draft_items),
        unresolved_synonyms=newly_unresolved,
    )


# ── Receipt Drafts ────────────────────────────────────────────────────────────

@router.get("/drafts", response_model=List[ReceiptDraftOut])
async def list_drafts(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(ReceiptDraft).order_by(ReceiptDraft.created_at.desc()))
    return result.scalars().all()


@router.patch("/drafts/{draft_id}", response_model=ReceiptDraftOut)
async def update_draft(
    draft_id: int,
    data: ReceiptDraftUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(ReceiptDraft).where(ReceiptDraft.id == draft_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.items = [item.model_dump() for item in data.items]
    await db.commit()
    await db.refresh(draft)
    return draft


@router.delete("/drafts/{draft_id}")
async def delete_draft(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(select(ReceiptDraft).where(ReceiptDraft.id == draft_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    await db.delete(draft)
    await db.commit()
    return {"ok": True}


@router.post("/drafts/{draft_id}/commit")
async def commit_draft(
    draft_id: int,
    data: ReceiptDraftCommit,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Commit a receipt draft to the warehouse.
    The request body contains the final (possibly edited) list of items to add.
    The draft is deleted after committing.
    """
    result = await db.execute(select(ReceiptDraft).where(ReceiptDraft.id == draft_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    today = date.today()
    count = 0
    for item in data.items:
        if item.name.strip():
            db.add(StockItem(name=item.name.strip(), quantity=item.quantity, added_on=today))
            count += 1

    await db.delete(draft)
    await db.commit()
    return {"items_added": count}


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
