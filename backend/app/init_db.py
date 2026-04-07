"""Initialize database with default users and directory data."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.config import settings
from app.database import Base
from app.models import User, RecipeCategory, CookingMethodDirectory
from app.auth import get_password_hash


# Old enum key → (Russian name, emoji)
_DEFAULT_COOKING_METHODS = [
    ("boiling",    "Варка",                     "🫕"),
    ("frying",     "Жарка",                     "🍳"),
    ("dry_frying", "Жарка на сухой сковороде",  "🥘"),
    ("stewing",    "Тушение",                   "♨️"),
    ("air_fryer",  "Аэрогриль",                 "💨"),
    ("baking",     "Запекание",                 "🔥"),
    ("raw",        "Сырое",                     "🥗"),
    ("sous_vide",  "Су-вид",                    "♨️"),
    ("grill",      "Гриль",                     "🍖"),
    ("other",      "Разное",                    "🍽️"),
]

_DEFAULT_CATEGORIES = [
    "суп", "мясо", "курица", "рыба", "завтрак", "закуска",
    "салат", "гарнир", "морепродукты", "субпродукты",
    "высокобелковые продукты", "напитки", "вафли", "соус", "сладкий соус",
]


async def seed_directories(session) -> None:
    """Seed cooking methods and recipe categories.

    For cooking methods: if an entry with the old enum key name exists
    (e.g. "boiling"), rename it to the proper Russian name and set emoji.
    If neither the old nor the new name exists, create a fresh entry.

    For categories: create any that are missing.
    """
    for old_key, new_name, emoji in _DEFAULT_COOKING_METHODS:
        # Try to find by old enum key first
        result = await session.execute(
            select(CookingMethodDirectory).where(CookingMethodDirectory.name == old_key)
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.name = new_name
            entry.emoji = emoji
            continue

        # Already has the proper name?
        result = await session.execute(
            select(CookingMethodDirectory).where(CookingMethodDirectory.name == new_name)
        )
        if result.scalar_one_or_none():
            continue

        session.add(CookingMethodDirectory(name=new_name, emoji=emoji))

    for cat_name in _DEFAULT_CATEGORIES:
        result = await session.execute(
            select(RecipeCategory).where(RecipeCategory.name == cat_name)
        )
        if not result.scalar_one_or_none():
            session.add(RecipeCategory(name=cat_name))

    await session.commit()


async def init_db():
    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        for username, password in [
            (settings.USER1_NAME, settings.USER1_PASSWORD),
            (settings.USER2_NAME, settings.USER2_PASSWORD),
            (settings.SERVICE_USER_NAME, settings.SERVICE_USER_PASSWORD),
        ]:
            result = await session.execute(select(User).where(User.username == username))
            existing = result.scalar_one_or_none()
            if not existing:
                user = User(username=username, hashed_password=get_password_hash(password))
                session.add(user)
                print(f"Created user: {username}")
            else:
                # Update password in case it changed in env
                existing.hashed_password = get_password_hash(password)
                print(f"Updated user: {username}")
        await session.commit()

        await seed_directories(session)
        print("Directories seeded.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
