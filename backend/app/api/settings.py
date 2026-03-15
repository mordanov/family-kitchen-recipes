from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import AppSettings
from app.auth import get_current_user

router = APIRouter()


@router.get("/openai-key-set")
async def openai_key_set(_=Depends(get_current_user)):
    from app.config import settings
    return {"set": bool(settings.OPENAI_API_KEY)}
