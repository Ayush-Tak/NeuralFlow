import asyncio
import json
import os
from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("google-calendar")


def _load_credentials() -> Credentials:
    """Load Google OAuth credentials from GOOGLE_TOKEN_JSON."""

    token_json = os.getenv("GOOGLE_TOKEN_JSON")
    if not token_json:
        raise RuntimeError("GOOGLE_TOKEN_JSON is required")

    try:
        token_info = json.loads(token_json)
    except json.JSONDecodeError as exc:
        raise RuntimeError("GOOGLE_TOKEN_JSON must be valid JSON") from exc

    creds = Credentials.from_authorized_user_info(token_info)
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
    return creds


def _calendar_service() -> Any:
    """Create a Google Calendar API service from environment credentials."""

    return build("calendar", "v3", credentials=_load_credentials(), cache_discovery=False)


@mcp.tool()
async def list_events(date: str = "", max_results: int = 10) -> list[dict[str, Any]]:
    """List calendar events. Date can be RFC3339, YYYY-MM-DD, 'today', or 'tomorrow'. Defaults to today."""

    def _list() -> list[dict[str, Any]]:
        try:
            from datetime import datetime, timedelta
            import re

            # Normalize date input
            now = datetime.now().astimezone()
            if not date or date.lower() == "today":
                time_min = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            elif date.lower() == "tomorrow":
                tomorrow = now + timedelta(days=1)
                time_min = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            elif re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                # Plain date like 2026-04-26 → add time and timezone
                time_min = f"{date}T00:00:00{now.strftime('%z')[:3]}:{now.strftime('%z')[3:]}"
            else:
                # Assume already RFC3339
                time_min = date

            service = _calendar_service()
            response = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min,
                    maxResults=max_results,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
            return response.get("items", [])
        except HttpError as exc:
            raise RuntimeError(f"Google Calendar list_events failed: {exc}") from exc

    return await asyncio.to_thread(_list)


@mcp.tool()
async def create_event(
    title: str,
    start: str,
    end: str,
    description: str = "",
) -> dict[str, Any]:
    """Create a calendar event using RFC3339 start and end datetimes."""

    def _create() -> dict[str, Any]:
        try:
            service = _calendar_service()
            body = {
                "summary": title,
                "description": description,
                "start": {"dateTime": start},
                "end": {"dateTime": end},
            }
            return service.events().insert(calendarId="primary", body=body).execute()
        except HttpError as exc:
            raise RuntimeError(f"Google Calendar create_event failed: {exc}") from exc

    return await asyncio.to_thread(_create)


@mcp.tool()
async def delete_event(event_id: str) -> dict[str, str]:
    """Delete a calendar event by id."""

    def _delete() -> dict[str, str]:
        try:
            service = _calendar_service()
            service.events().delete(calendarId="primary", eventId=event_id).execute()
            return {"status": "deleted", "event_id": event_id}
        except HttpError as exc:
            raise RuntimeError(f"Google Calendar delete_event failed: {exc}") from exc

    return await asyncio.to_thread(_delete)


if __name__ == "__main__":
    mcp.run()

