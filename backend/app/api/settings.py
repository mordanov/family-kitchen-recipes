import json

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import AppSettings
from app.auth import get_current_user
from app.schemas import SynonymsOut, SynonymsUpdate

router = APIRouter()

PRODUCT_SYNONYMS_KEY = "warehouse_product_synonyms"
PHRASE_SYNONYMS_KEY = "warehouse_phrase_synonyms"


def _load_aliases(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}

    cleaned: dict[str, str] = {}
    for k, v in data.items():
        if not isinstance(k, str) or not isinstance(v, str):
            continue
        key = k.strip().lower()
        val = v.strip().lower()
        if key and val:
            cleaned[key] = val
    return cleaned


async def _get_setting(db: AsyncSession, key: str) -> AppSettings | None:
    result = await db.execute(select(AppSettings).where(AppSettings.key == key))
    return result.scalar_one_or_none()


@router.get("/openai-key-set")
async def openai_key_set(_=Depends(get_current_user)):
    from app.config import settings
    return {"set": bool(settings.OPENAI_API_KEY)}


@router.get("/warehouse/product-synonyms", response_model=SynonymsOut)
async def get_product_synonyms(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    setting = await _get_setting(db, PRODUCT_SYNONYMS_KEY)
    return {"aliases": _load_aliases(setting.value if setting else None)}


@router.put("/warehouse/product-synonyms", response_model=SynonymsOut)
async def set_product_synonyms(
    data: SynonymsUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    setting = await _get_setting(db, PRODUCT_SYNONYMS_KEY)
    value = json.dumps(data.aliases, ensure_ascii=False)
    if setting:
        setting.value = value
    else:
        db.add(AppSettings(key=PRODUCT_SYNONYMS_KEY, value=value))
    await db.commit()
    return {"aliases": data.aliases}


@router.get("/warehouse/phrase-synonyms", response_model=SynonymsOut)
async def get_phrase_synonyms(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    setting = await _get_setting(db, PHRASE_SYNONYMS_KEY)
    return {"aliases": _load_aliases(setting.value if setting else None)}


@router.put("/warehouse/phrase-synonyms", response_model=SynonymsOut)
async def set_phrase_synonyms(
    data: SynonymsUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    setting = await _get_setting(db, PHRASE_SYNONYMS_KEY)
    value = json.dumps(data.aliases, ensure_ascii=False)
    if setting:
        setting.value = value
    else:
        db.add(AppSettings(key=PHRASE_SYNONYMS_KEY, value=value))
    await db.commit()
    return {"aliases": data.aliases}
