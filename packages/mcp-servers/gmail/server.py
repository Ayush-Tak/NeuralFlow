import asyncio
import base64
import json
import os
from email.message import EmailMessage
from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("gmail")


def _load_credentials() -> Credentials:
    """Load Google OAuth credentials from GOOGLE_TOKEN_JSON."""

    token_json = os.getenv("GOOGLE_TOKEN_JSON")
    if not token_json:
        raise RuntimeError("GOOGLE_TOKEN_JSON is required")

    try:
        token_info = json.loads(token_json)
    except json.JSONDecodeError as exc:
        raise RuntimeError("GOOGLE_TOKEN_JSON must be valid JSON") from exc

    return Credentials.from_authorized_user_info(token_info)


def _gmail_service() -> Any:
    """Create a Gmail API service from environment credentials."""

    return build("gmail", "v1", credentials=_load_credentials(), cache_discovery=False)


def _headers_by_name(payload: dict[str, Any]) -> dict[str, str]:
    """Return Gmail message headers keyed by header name."""

    return {
        header["name"]: header["value"]
        for header in payload.get("headers", [])
        if "name" in header and "value" in header
    }


@mcp.tool()
async def list_emails(query: str = "is:unread", max_results: int = 10) -> list[dict[str, Any]]:
    """List Gmail messages matching a query."""

    def _list() -> list[dict[str, Any]]:
        try:
            service = _gmail_service()
            response = (
                service.users()
                .messages()
                .list(userId="me", q=query, maxResults=max_results)
                .execute()
            )
            messages = response.get("messages", [])
            emails: list[dict[str, Any]] = []
            for message in messages:
                detail = (
                    service.users()
                    .messages()
                    .get(userId="me", id=message["id"], format="metadata")
                    .execute()
                )
                headers = _headers_by_name(detail.get("payload", {}))
                emails.append(
                    {
                        "id": detail["id"],
                        "thread_id": detail.get("threadId"),
                        "subject": headers.get("Subject"),
                        "from": headers.get("From"),
                        "date": headers.get("Date"),
                        "snippet": detail.get("snippet"),
                    }
                )
            return emails
        except HttpError as exc:
            raise RuntimeError(f"Gmail list_emails failed: {exc}") from exc

    return await asyncio.to_thread(_list)


@mcp.tool()
async def read_email(email_id: str) -> dict[str, Any]:
    """Read a Gmail message by id."""

    def _read() -> dict[str, Any]:
        try:
            service = _gmail_service()
            message = (
                service.users()
                .messages()
                .get(userId="me", id=email_id, format="full")
                .execute()
            )
            headers = _headers_by_name(message.get("payload", {}))
            return {
                "id": message["id"],
                "thread_id": message.get("threadId"),
                "headers": headers,
                "snippet": message.get("snippet"),
                "payload": message.get("payload"),
            }
        except HttpError as exc:
            raise RuntimeError(f"Gmail read_email failed: {exc}") from exc

    return await asyncio.to_thread(_read)


@mcp.tool()
async def send_email(to: str, subject: str, body: str) -> dict[str, Any]:
    """Send an email through Gmail."""

    def _send() -> dict[str, Any]:
        try:
            message = EmailMessage()
            message["To"] = to
            message["Subject"] = subject
            message.set_content(body)

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
            service = _gmail_service()
            return service.users().messages().send(userId="me", body={"raw": raw}).execute()
        except HttpError as exc:
            raise RuntimeError(f"Gmail send_email failed: {exc}") from exc

    return await asyncio.to_thread(_send)


if __name__ == "__main__":
    mcp.run()

