from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException
from jose import jwt

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.auth import create_access_token, get_current_user, get_password_hash, verify_password
from app.config import settings


@pytest.mark.asyncio
async def test_password_hash_round_trip_supports_long_password():
    password = "x" * 120

    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False


@pytest.mark.asyncio
async def test_create_access_token_includes_subject_and_expiry():
    token = create_access_token({"sub": "chef"}, expires_delta=timedelta(minutes=5))

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    assert payload["sub"] == "chef"
    assert payload["exp"] > datetime.now(timezone.utc).timestamp()


@pytest.mark.asyncio
async def test_get_current_user_returns_matching_user(session, sample_user):
    token = create_access_token({"sub": sample_user.username})

    current_user = await get_current_user(token=token, db=session)

    assert current_user.id == sample_user.id
    assert current_user.username == sample_user.username


@pytest.mark.asyncio
async def test_get_current_user_rejects_token_without_subject(session):
    token = create_access_token({"scope": "recipes:read"})

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token=token, db=session)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Could not validate credentials"
