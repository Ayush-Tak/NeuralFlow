import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("GOOGLE_CLIENT_ID", "google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "google-client-secret")
os.environ.setdefault("GOOGLE_REDIRECT_URI", "http://test/auth/google/callback")
os.environ.setdefault("GITHUB_CLIENT_ID", "github-client-id")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "github-client-secret")
os.environ.setdefault("GITHUB_REDIRECT_URI", "http://test/auth/github/callback")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")

from main import app as fastapi_app  # noqa: E402
from models.flow import Flow  # noqa: E402
from services.auth_utils import create_access_token  # noqa: E402


class FakeScalarResult:
    """Small scalar result wrapper for mocked SQLAlchemy execute calls."""

    def __init__(self, values: list[Any]) -> None:
        self.values = values

    def all(self) -> list[Any]:
        """Return all scalar values."""

        return self.values

    def scalar_one_or_none(self) -> Any | None:
        """Return the first scalar value or None."""

        return self.values[0] if self.values else None


class FakeExecuteResult:
    """Small execute result wrapper for mocked SQLAlchemy sessions."""

    def __init__(self, values: list[Any]) -> None:
        self.values = values

    def scalars(self) -> FakeScalarResult:
        """Return scalar result wrapper."""

        return FakeScalarResult(self.values)

    def scalar_one_or_none(self) -> Any | None:
        """Return the first value or None."""

        return self.values[0] if self.values else None


class MockDatabaseSession:
    """In-memory async database session used by API tests."""

    def __init__(self) -> None:
        self.flows: dict[str, Flow] = {}

    def add(self, obj: Any) -> None:
        """Add a model object to the in-memory store."""

        self._hydrate_model(obj)
        if isinstance(obj, Flow):
            self.flows[str(obj.id)] = obj

    async def commit(self) -> None:
        """Mock commit."""

    async def refresh(self, obj: Any) -> None:
        """Refresh a model object with generated values."""

        self._hydrate_model(obj)

    async def delete(self, obj: Any) -> None:
        """Delete a model object from the in-memory store."""

        if isinstance(obj, Flow):
            self.flows.pop(str(obj.id), None)

    async def execute(self, statement: Any) -> FakeExecuteResult:
        """Return all stored flows for list endpoints."""

        return FakeExecuteResult(list(self.flows.values()))

    async def get(self, model: type[Any], object_id: Any) -> Any | None:
        """Return an object by id."""

        if model is Flow:
            return self.flows.get(str(object_id))
        return None

    @staticmethod
    def _hydrate_model(obj: Any) -> None:
        """Assign generated id and timestamp fields used by responses."""

        if getattr(obj, "id", None) is None:
            obj.id = uuid4()
        now = datetime.now(UTC)
        if hasattr(obj, "created_at") and getattr(obj, "created_at", None) is None:
            obj.created_at = now
        if hasattr(obj, "updated_at") and getattr(obj, "updated_at", None) is None:
            obj.updated_at = now


@pytest.fixture
def app():
    """Return the FastAPI test application."""

    fastapi_app.dependency_overrides.clear()
    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app):
    """Return an async HTTP client bound to the FastAPI app."""

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client


@pytest.fixture
def mock_db() -> MockDatabaseSession:
    """Return a mock database session."""

    return MockDatabaseSession()


@pytest.fixture
def test_user() -> dict[str, Any]:
    """Return a fake user payload and JWT token."""

    user_id = uuid4()
    return {
        "id": user_id,
        "email": "test@neuralflow.local",
        "name": "Test User",
        "avatar_url": "https://example.com/avatar.png",
        "token": create_access_token(str(user_id)),
        "object": SimpleNamespace(
            id=user_id,
            email="test@neuralflow.local",
            name="Test User",
            avatar_url="https://example.com/avatar.png",
            google_token=None,
            github_token=None,
        ),
    }
