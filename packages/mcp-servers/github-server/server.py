import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = "https://api.github.com"
mcp = FastMCP("github")


def _headers() -> dict[str, str]:
    """Return GitHub API headers using GITHUB_TOKEN."""

    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN is required")

    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def _request(method: str, path: str, **kwargs: Any) -> Any:
    """Call the GitHub REST API and return JSON."""

    async with httpx.AsyncClient(base_url=API_BASE, headers=_headers(), timeout=30.0) as client:
        response = await client.request(method, path, **kwargs)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"GitHub API request failed: {response.text}") from exc
    return response.json() if response.content else {}


@mcp.tool()
async def list_repos(max_results: int = 10) -> list[dict[str, Any]]:
    """List repositories visible to the authenticated GitHub token."""

    return await _request(
        "GET",
        "/user/repos",
        params={"per_page": max_results, "sort": "updated", "affiliation": "owner,collaborator"},
    )


@mcp.tool()
async def list_issues(repo: str, state: str = "open") -> list[dict[str, Any]]:
    """List issues for a repository in owner/name form."""

    issues = await _request("GET", f"/repos/{repo}/issues", params={"state": state})
    return [issue for issue in issues if "pull_request" not in issue]


@mcp.tool()
async def create_issue(repo: str, title: str, body: str) -> dict[str, Any]:
    """Create an issue in a repository in owner/name form."""

    return await _request("POST", f"/repos/{repo}/issues", json={"title": title, "body": body})


@mcp.tool()
async def list_pull_requests(repo: str, state: str = "open") -> list[dict[str, Any]]:
    """List pull requests for a repository in owner/name form."""

    return await _request("GET", f"/repos/{repo}/pulls", params={"state": state})


@mcp.tool()
async def get_repo_info(repo: str) -> dict[str, Any]:
    """Get metadata for a repository in owner/name form."""

    return await _request("GET", f"/repos/{repo}")


if __name__ == "__main__":
    mcp.run()

