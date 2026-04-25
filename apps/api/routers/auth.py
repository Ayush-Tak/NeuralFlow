import asyncio
import json
from typing import Any, Annotated
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.database import get_db
from models.user import User
from services.auth_utils import create_access_token, verify_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.readonly",
]


class TokenResponse(BaseModel):
    """JWT response returned after OAuth callbacks."""

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public user payload."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str | None
    avatar_url: str | None
    has_google: bool
    has_github: bool





async def _upsert_user(
    db: AsyncSession,
    *,
    email: str,
    name: str | None,
    avatar_url: str | None,
    google_token: dict[str, Any] | None = None,
    github_token: dict[str, Any] | None = None,
) -> User:
    """Create or update a user by email."""

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(email=email, name=name, avatar_url=avatar_url)
        db.add(user)

    user.name = name or user.name
    user.avatar_url = avatar_url or user.avatar_url

    if google_token is not None:
        user.google_token = google_token
    if github_token is not None:
        user.github_token = github_token

    await db.commit()
    await db.refresh(user)
    return user


security = HTTPBearer()

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Resolve the authenticated user from a bearer JWT."""

    token = credentials.credentials
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        payload = verify_access_token(token)
        user_id = UUID(str(payload["sub"]))
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
        ) from exc

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.get("/google/login")
async def google_login() -> RedirectResponse:
    """Redirect the user to the Google OAuth consent screen."""

    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": " ".join(GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    return RedirectResponse(
        f"https://accounts.google.com/o/oauth2/v2/auth?{params}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/google/callback")
async def google_callback(
    code: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RedirectResponse:
    """Exchange a Google OAuth code for tokens and redirect to frontend."""

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.google_redirect_uri,
            },
        )
        token_response.raise_for_status()
        credentials = token_response.json()
        access_token = credentials.get("access_token")

        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        profile = response.json()

    # Inject client_id and client_secret so MCP servers can
    # reconstruct google.oauth2.credentials.Credentials via
    # Credentials.from_authorized_user_info().
    credentials["client_id"] = settings.google_client_id
    credentials["client_secret"] = settings.google_client_secret

    user = await _upsert_user(
        db,
        email=profile["email"],
        name=profile.get("name"),
        avatar_url=profile.get("picture"),
        google_token=credentials,
    )
    token = create_access_token(str(user.id))
    return RedirectResponse(f"{settings.frontend_url}/auth/callback?token={token}")


@router.get("/github/login")
async def github_login() -> RedirectResponse:
    """Redirect the user to the GitHub OAuth consent screen."""

    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "repo read:user user:email",
        }
    )
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize?{params}",
        status_code=status.HTTP_302_FOUND,
    )

@router.get("/github/connect")
async def github_connect(token: Annotated[str, Query()]) -> RedirectResponse:
    """Redirect the user to the GitHub OAuth consent screen for account linking."""

    verify_access_token(token)
    
    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "repo read:user user:email",
            "state": token,
        }
    )
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize?{params}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/github/callback")
async def github_callback(
    code: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
    state: str | None = None,
) -> RedirectResponse:
    """Exchange a GitHub OAuth code for tokens and redirect to frontend."""

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
        )
        token_response.raise_for_status()
        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="GitHub did not return an access token")

        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        user_response.raise_for_status()
        github_user = user_response.json()

        email = github_user.get("email")
        if not email:
            emails_response = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            emails_response.raise_for_status()
            emails = emails_response.json()
            primary_email = next(
                (item["email"] for item in emails if item.get("primary") and item.get("verified")),
                None,
            )
            email = primary_email or next(
                (item["email"] for item in emails if item.get("verified")),
                None,
            )

    if state:
        try:
            payload = verify_access_token(state)
            user_id = UUID(str(payload["sub"]))
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid state token") from exc

        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        user.github_token = token_payload
        await db.commit()
        return RedirectResponse(f"{settings.frontend_url}/")

    if not email:
        raise HTTPException(status_code=400, detail="Unable to resolve GitHub email")

    user = await _upsert_user(
        db,
        email=email,
        name=github_user.get("name") or github_user.get("login"),
        avatar_url=github_user.get("avatar_url"),
        github_token=token_payload,
    )
    token = create_access_token(str(user.id))
    return RedirectResponse(f"{settings.frontend_url}/auth/callback?token={token}")


@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> dict:
    """Return the current authenticated user with connection statuses."""

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatar_url": current_user.avatar_url,
        "has_google": current_user.google_token is not None,
        "has_github": current_user.github_token is not None,
    }


@router.delete("/integrations/{provider}")
async def disconnect_integration(
    provider: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Remove an OAuth integration from the current user."""

    if provider == "google":
        current_user.google_token = None
    elif provider == "github":
        current_user.github_token = None
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    await db.commit()
    return {"status": "disconnected", "provider": provider}
