from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from models.user import User
from routers.auth import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    """Simple chat request payload."""

    message: str


class ChatResponse(BaseModel):
    """Simple chat response payload."""

    reply: str


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatMessage,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ChatResponse:
    """Placeholder chat endpoint for future agent integration."""

    return ChatResponse(reply=f"{current_user.name or current_user.email}: {payload.message}")

