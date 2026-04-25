from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import connect_db, disconnect_db, engine, Base
from models.user import User
from models.flow import Flow
from routers import auth, chat, flows, ws


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Connect to Postgres on startup and close it on shutdown."""

    await connect_db()

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    try:
        yield
    finally:
        await disconnect_db()


import os

app = FastAPI(title="NeuralFlow API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(flows.router)
app.include_router(chat.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Return API health status."""

    return {"status": "ok", "version": "0.1.0"}
