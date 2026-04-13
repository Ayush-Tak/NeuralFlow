from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from config import settings


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT for the given subject."""

    expire_at = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.jwt_expires_minutes)
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token."""

    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid access token") from exc

