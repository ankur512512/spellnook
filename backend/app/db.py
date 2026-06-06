"""Database engine/session + table init.

MVP creates tables on startup (Base.metadata.create_all). For prod, swap this
for Alembic migrations (tracked as a hardening TODO).
"""
from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://spellnook:spellnook@db:5432/spellnook"
)


class Base(DeclarativeBase):
    pass


engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db(retries: int = 10, delay: float = 1.5) -> None:
    """Create tables, retrying while Postgres finishes starting up."""
    from . import models  # noqa: F401 - register mappers

    last_exc: Exception | None = None
    for _ in range(retries):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            return
        except Exception as exc:  # noqa: BLE001 - DB may still be booting
            last_exc = exc
            await asyncio.sleep(delay)
    # Don't crash the whole app if the DB is unreachable; auth endpoints will
    # surface errors, but health/game/multiplayer keep working.
    print(f"WARN: init_db gave up after retries: {last_exc}")
