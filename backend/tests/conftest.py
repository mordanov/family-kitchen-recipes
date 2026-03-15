from pathlib import Path
import sys

import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from datetime import date

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.auth import get_password_hash
from app.database import Base
from app.models import CookingMethod, Recipe, User, FamilyMember, DietModel, Gender


@pytest_asyncio.fixture
async def session(tmp_path: Path):
    db_path = tmp_path / "test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", future=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db_session:
        yield db_session

    await engine.dispose()


@pytest_asyncio.fixture
async def sample_user(session):
    user = User(username="chef", hashed_password=get_password_hash("very-secret-password"))
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_recipe(session):
    recipe = Recipe(
        title="Суп",
        ingredients="картофель\nморковь\nлук",
        shopping_list="картофель\nморковь\nлук",
        cooking_method=CookingMethod.boiling,
        servings=4,
    )
    session.add(recipe)
    await session.commit()
    await session.refresh(recipe)
    return recipe


@pytest_asyncio.fixture
async def sample_member(session):
    member = FamilyMember(
        name="Алиса",
        weight=55.0,
        age=30,
        gender=Gender.female,
        diet_model=DietModel.weight_maintain,
        color="#4ECDC4",
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member

