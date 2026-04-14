import asyncio
import json
import os
from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("google-drive")


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


def _drive_service() -> Any:
    """Create a Google Drive API service from environment credentials."""

    return build("drive", "v3", credentials=_load_credentials(), cache_discovery=False)


@mcp.tool()
async def list_files(
    query: str = "",
    max_results: int = 10,
    order_by: str = "modifiedTime desc",
) -> list[dict[str, Any]]:
    """List files in Google Drive. Use query for search (e.g. "name contains 'report'")."""

    def _list() -> list[dict[str, Any]]:
        try:
            service = _drive_service()
            params: dict[str, Any] = {
                "pageSize": max_results,
                "orderBy": order_by,
                "fields": "files(id, name, mimeType, modifiedTime, size, webViewLink, owners)",
            }
            if query:
                params["q"] = query
            response = service.files().list(**params).execute()
            return response.get("files", [])
        except HttpError as exc:
            raise RuntimeError(f"Google Drive list_files failed: {exc}") from exc

    return await asyncio.to_thread(_list)


@mcp.tool()
async def get_file(file_id: str) -> dict[str, Any]:
    """Get metadata for a specific file by ID."""

    def _get() -> dict[str, Any]:
        try:
            service = _drive_service()
            return (
                service.files()
                .get(
                    fileId=file_id,
                    fields="id, name, mimeType, modifiedTime, size, webViewLink, owners, description",
                )
                .execute()
            )
        except HttpError as exc:
            raise RuntimeError(f"Google Drive get_file failed: {exc}") from exc

    return await asyncio.to_thread(_get)


@mcp.tool()
async def read_file(file_id: str) -> str:
    """Read the text content of a Google Drive file (Google Docs, Sheets exported as plain text, or plain text files)."""

    def _read() -> str:
        try:
            service = _drive_service()
            meta = service.files().get(fileId=file_id, fields="mimeType").execute()
            mime = meta.get("mimeType", "")

            # Google Docs → export as plain text
            if mime == "application/vnd.google-apps.document":
                content = service.files().export(fileId=file_id, mimeType="text/plain").execute()
                return content.decode("utf-8") if isinstance(content, bytes) else str(content)

            # Google Sheets → export as CSV
            if mime == "application/vnd.google-apps.spreadsheet":
                content = service.files().export(fileId=file_id, mimeType="text/csv").execute()
                return content.decode("utf-8") if isinstance(content, bytes) else str(content)

            # Google Slides → export as plain text
            if mime == "application/vnd.google-apps.presentation":
                content = service.files().export(fileId=file_id, mimeType="text/plain").execute()
                return content.decode("utf-8") if isinstance(content, bytes) else str(content)

            # Regular files → download content
            content = service.files().get_media(fileId=file_id).execute()
            return content.decode("utf-8") if isinstance(content, bytes) else str(content)

        except HttpError as exc:
            raise RuntimeError(f"Google Drive read_file failed: {exc}") from exc

    return await asyncio.to_thread(_read)


@mcp.tool()
async def search_files(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    """Search Google Drive files by name. Wraps the query in a fullText search."""

    search_query = f"fullText contains '{query}'"
    return await list_files(query=search_query, max_results=max_results)


if __name__ == "__main__":
    mcp.run()
