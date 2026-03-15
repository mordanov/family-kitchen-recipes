from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.schemas import Token, LoginRequest
from app.auth import verify_password, create_access_token, get_current_user

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    
    token = create_access_token({"sub": user.username})
    return Token(access_token=token, token_type="bearer", username=user.username)


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username, "id": current_user.id}
