"""Initialize database with default users from env variables."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.config import settings
from app.database import Base
from app.models import User
from app.auth import get_password_hash


async def init_db():
    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        for username, password in [
            (settings.USER1_NAME, settings.USER1_PASSWORD),
            (settings.USER2_NAME, settings.USER2_PASSWORD),
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

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
