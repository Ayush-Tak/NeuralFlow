from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings


class Base(DeclarativeBase):
    """Base class for SQLAlchemy ORM models."""


engine = create_async_engine(settings.database_url, pool_pre_ping=True)
async_session_factory = async_sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


async def connect_db() -> None:
    """Validate the database connection during application startup."""

    async with engine.begin() as connection:
        await connection.execute(text("SELECT 1"))


async def disconnect_db() -> None:
    """Dispose of database connections during application shutdown."""

    await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLAlchemy session for FastAPI dependencies."""

    async with async_session_factory() as session:
        yield session

