import json
import os
import sys
from pathlib import Path
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient

SERVER_PATHS = {
    "google-calendar": Path("packages/mcp-servers/google-calendar/server.py"),
    "gmail": Path("packages/mcp-servers/gmail/server.py"),
    "google-drive": Path("packages/mcp-servers/google-drive/server.py"),
    "github": Path("packages/mcp-servers/github-server/server.py"),
}


class MCPClientManager:
    """Manage stdio MCP connections and tool calls for NeuralFlow integrations."""

    def __init__(self, repo_root: Path | None = None, user: Any | None = None) -> None:
        """Initialize a MultiServerMCPClient for all local MCP servers."""

        self.repo_root = repo_root or self._discover_repo_root()
        self.user = user
        self.connections = self._build_connections()
        self.client = MultiServerMCPClient(self.connections, tool_name_prefix=True)

    async def get_tools_for_user(self, user: Any) -> list[Any]:
        """Return tools only for integrations connected on the user record."""

        connected_servers = self.get_connected_integrations(user)
        tools: list[Any] = []
        for server_name in connected_servers:
            tools.extend(await self.client.get_tools(server_name=server_name))
        return tools

    def get_connected_integrations(self, user: Any | None = None) -> list[str]:
        """Return MCP server names connected for a user."""

        return self._connected_servers_for_user(user or self.user)

    async def call_tool(self, server_name: str, tool_name: str, args: dict[str, Any]) -> Any:
        """Call a specific MCP tool by server and tool name."""

        tools = await self.client.get_tools(server_name=server_name)
        candidates = {
            getattr(tool, "name", ""): tool
            for tool in tools
        }
        tool = (
            candidates.get(tool_name)
            or candidates.get(f"{server_name}_{tool_name}")
            or candidates.get(f"{server_name}__{tool_name}")
        )
        if tool is None:
            available = ", ".join(sorted(name for name in candidates if name))
            raise ValueError(
                f"MCP tool not found: {server_name}.{tool_name}. Available tools: {available}"
            )

        if hasattr(tool, "ainvoke"):
            result = await tool.ainvoke(args)
            # Unwrap LangChain ToolMessage → MCP content blocks → actual data
            content = getattr(result, "content", result)
            return self._unwrap_mcp_content(content)
        raise TypeError(f"MCP tool does not support async invocation: {server_name}.{tool_name}")

    @staticmethod
    def _unwrap_mcp_content(content: Any) -> Any:
        """Extract real tool data from LangChain/MCP response wrappers.

        Handles multiple layers:
        1. ToolMessage.content may be a JSON string → parse it
        2. Parsed result may be MCP content blocks [{type, text}] → extract text
        3. Text inside blocks may be JSON → parse again
        """

        # Layer 1: If string, parse JSON
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                return content
            # Fall through to check if parsed result is content blocks

        # Layer 2: If list of MCP content blocks [{type: "text", text: "..."}]
        if isinstance(content, list) and content:
            first = content[0]
            if isinstance(first, dict) and "text" in first and first.get("type") == "text":
                texts = [block["text"] for block in content if block.get("type") == "text"]
                if len(texts) == 1:
                    # Layer 3: Parse the text content
                    try:
                        return json.loads(texts[0])
                    except (json.JSONDecodeError, TypeError):
                        return texts[0]
                parsed = []
                for t in texts:
                    try:
                        parsed.append(json.loads(t))
                    except (json.JSONDecodeError, TypeError):
                        parsed.append(t)
                return parsed

        return content

    def _build_connections(self) -> dict[str, dict[str, Any]]:
        """Build stdio connection definitions for all MCP servers."""

        return {
            server_name: {
                "transport": "stdio",
                "command": sys.executable,
                "args": [str(self.repo_root / relative_path)],
                "env": self._server_env(server_name, self.user),
            }
            for server_name, relative_path in SERVER_PATHS.items()
        }

    @staticmethod
    def _server_env(server_name: str, user: Any | None = None) -> dict[str, str]:
        """Return environment variables needed by an MCP server subprocess."""

        env = dict(os.environ)
        google_token = getattr(user, "google_token", None)
        github_token = getattr(user, "github_token", None)

        if server_name in {"google-calendar", "gmail", "google-drive"}:
            if google_token:
                env["GOOGLE_TOKEN_JSON"] = json.dumps(google_token)
            elif "GOOGLE_TOKEN_JSON" not in env:
                env["GOOGLE_TOKEN_JSON"] = ""

        if server_name == "github":
            if isinstance(github_token, dict) and github_token.get("access_token"):
                env["GITHUB_TOKEN"] = str(github_token["access_token"])
            elif isinstance(github_token, str):
                env["GITHUB_TOKEN"] = github_token
            elif "GITHUB_TOKEN" not in env:
                env["GITHUB_TOKEN"] = ""

        return env

    @staticmethod
    def _connected_servers_for_user(user: Any) -> list[str]:
        """Infer connected integrations from token fields on a user object."""

        if user is None:
            return []

        connected: list[str] = []
        if getattr(user, "google_token", None):
            connected.extend(["google-calendar", "gmail", "google-drive"])
        if getattr(user, "github_token", None):
            connected.append("github")
        return connected

    @staticmethod
    def _discover_repo_root() -> Path:
        """Discover the monorepo root from this file location."""
        current = Path(__file__).resolve()
        for p in [current, *current.parents]:
            if (p / "packages" / "mcp-servers").exists() or (p / "apps").exists():
                return p
        return Path("/app") if Path("/app").exists() else current.parents[0]
