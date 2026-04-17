import inspect
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, datetime
from typing import Any, Literal, NotRequired, TypedDict

import json

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from config import settings
from services.mcp_client import MCPClientManager

NodeStatus = Literal["idle", "running", "success", "error"]
NodeUpdateCallback = Callable[[str, NodeStatus, Any], None | Awaitable[None]]


class NodeExecutionResult(TypedDict):
    """Execution result for one workflow node."""

    node_id: str
    status: NodeStatus
    result: Any
    error: NotRequired[str | None]
    started_at: NotRequired[str | None]
    completed_at: NotRequired[str | None]


class WorkflowExecutor:
    """Execute a flow DAG sequentially and call MCP tools for action nodes."""

    def __init__(
        self,
        flow: Mapping[str, Any],
        mcp_client: MCPClientManager | None = None,
        on_node_update: NodeUpdateCallback | None = None,
    ) -> None:
        """Initialize the executor with a flow dict and optional status callback."""

        self.flow = flow
        self.nodes = self._normalize_nodes(flow.get("nodes", []))
        self.edges = self._normalize_edges(flow.get("edges", []))
        self.mcp_client = mcp_client or MCPClientManager()
        self.on_node_update = on_node_update
        self._children: dict[str, list[str]] = defaultdict(list)
        self._parents: dict[str, list[str]] = defaultdict(list)
        self._llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=settings.groq_api_key,
            temperature=0,
        )
        self._build_graph()

    async def execute(self) -> list[NodeExecutionResult]:
        """Execute nodes in topological order and return per-node results."""

        order = self._topological_sort()
        continue_on_error = self._continue_on_error(self.flow)
        results_by_node: dict[str, NodeExecutionResult] = {}

        for node_id in order:
            await self._emit(node_id, "idle", None)

        for node_id in order:
            node = self.nodes[node_id]
            started_at = self._now()
            await self._emit(node_id, "running", None)

            try:
                # Pass ALL previous results as context — any node can reference any earlier node
                result = await self._execute_node(node, dict(results_by_node))
                node_result: NodeExecutionResult = {
                    "node_id": node_id,
                    "status": "success",
                    "result": result,
                    "error": None,
                    "started_at": started_at,
                    "completed_at": self._now(),
                }
                results_by_node[node_id] = node_result
                await self._emit(node_id, "success", result)
            except Exception as exc:
                node_result = {
                    "node_id": node_id,
                    "status": "error",
                    "result": None,
                    "error": str(exc),
                    "started_at": started_at,
                    "completed_at": self._now(),
                }
                results_by_node[node_id] = node_result
                await self._emit(node_id, "error", {"error": str(exc)})

                if not self._continue_on_error(node, default=continue_on_error):
                    break

        return [results_by_node[node_id] for node_id in order if node_id in results_by_node]

    def _build_graph(self) -> None:
        """Build parent and child adjacency lists from normalized edges."""

        for edge in self.edges:
            source = edge["source"]
            target = edge["target"]
            if source not in self.nodes:
                raise ValueError(f"Edge source node does not exist: {source}")
            if target not in self.nodes:
                raise ValueError(f"Edge target node does not exist: {target}")
            self._children[source].append(target)
            self._parents[target].append(source)

    def _topological_sort(self) -> list[str]:
        """Return nodes in DAG topological order or raise on cycles."""

        indegree = {node_id: 0 for node_id in self.nodes}
        for edge in self.edges:
            indegree[edge["target"]] += 1

        queue = deque(node_id for node_id, degree in indegree.items() if degree == 0)
        order: list[str] = []

        while queue:
            node_id = queue.popleft()
            order.append(node_id)
            for child_id in self._children[node_id]:
                indegree[child_id] -= 1
                if indegree[child_id] == 0:
                    queue.append(child_id)

        if len(order) != len(self.nodes):
            raise ValueError("Workflow contains a cycle")
        return order

    async def _execute_node(self, node: Mapping[str, Any], context: dict[str, Any]) -> Any:
        """Execute one workflow node using MCP tool configuration."""

        node_type = str(node.get("type") or "")
        if node_type in {"trigger", "manual", "schedule"}:
            return {"triggered": True}

        if node_type == "aiAgent":
            return await self._execute_ai_agent(node, context)

        server_name, tool_name, config = self._resolve_tool(node)
        args = self._resolve_args(config, context)
        return await self.mcp_client.call_tool(server_name, tool_name, args)

    async def _execute_ai_agent(self, node: Mapping[str, Any], context: dict[str, Any]) -> Any:
        """Execute an AI Agent node by sending prompt + context to the LLM."""

        config = self._node_config(node)
        prompt = config.get("prompt") or "Analyze the following data and provide insights."

        # Slim down context — strip bulky fields like raw email payloads
        slim_context = self._slim_context(context)
        context_str = json.dumps(slim_context, default=str, indent=2)

        # Hard cap to avoid token limits
        if len(context_str) > 8000:
            context_str = context_str[:8000] + "\n... (truncated)"

        messages = [
            SystemMessage(content=(
                "You are a helpful AI assistant processing workflow data. "
                "If the user asks you to extract structured information (like event titles, dates, summaries), "
                "respond ONLY with a valid JSON object — no markdown, no explanation, just the JSON. "
                "Otherwise respond with plain text. Be concise."
            )),
            HumanMessage(content=f"{prompt}\n\nUpstream data:\n```json\n{context_str}\n```"),
        ]
        response = await self._llm.ainvoke(messages)
        text = response.content.strip()

        # Try to parse as JSON so downstream nodes can access structured fields
        try:
            parsed = json.loads(text)
            return parsed
        except (json.JSONDecodeError, TypeError):
            return {"response": text}

    @staticmethod
    def _slim_context(context: dict[str, Any]) -> dict[str, Any]:
        """Remove bulky fields from upstream results to reduce token usage."""

        slim: dict[str, Any] = {}
        for node_id, node_result in context.items():
            if not isinstance(node_result, Mapping):
                slim[node_id] = node_result
                continue
            result = node_result.get("result")
            if isinstance(result, Mapping):
                # Strip raw email payload/headers — keep useful summary fields
                result = {
                    k: v for k, v in result.items()
                    if k not in ("payload", "raw", "labelIds", "historyId", "internalDate")
                }
            elif isinstance(result, list):
                result = [
                    {k: v for k, v in item.items() if k not in ("payload", "raw", "labelIds", "historyId", "internalDate")}
                    if isinstance(item, Mapping) else item
                    for item in result
                ]
            slim[node_id] = {
                "status": node_result.get("status"),
                "result": result,
            }
        return slim

    def _resolve_tool(self, node: Mapping[str, Any]) -> tuple[str, str, dict[str, Any]]:
        """Resolve MCP server and tool names from node config or type."""

        config = self._node_config(node)
        server_name = config.get("server_name") or config.get("server") or node.get("server")
        tool_name = config.get("tool_name") or config.get("tool") or node.get("tool")

        if not server_name or not tool_name:
            parsed = self._parse_type(str(node.get("type") or ""))
            server_name = server_name or parsed[0]
            tool_name = tool_name or parsed[1]

        if not server_name or not tool_name:
            node_id = node.get("id", "<unknown>")
            raise ValueError(f"Node {node_id} is missing MCP server/tool configuration")

        return str(server_name), str(tool_name), config

    def _resolve_args(self, config: Mapping[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Resolve tool arguments, including context placeholders."""

        raw_args = config.get("args") or config.get("arguments") or {}
        if not isinstance(raw_args, Mapping):
            raise ValueError("Node tool arguments must be an object")

        args = {
            str(key): self._resolve_value(value, context)
            for key, value in raw_args.items()
        }

        # Auto-fill: if any arg resolved to None and looks like it needs an ID,
        # try to find it from the most recent upstream result
        for key, value in args.items():
            if value is None and any(hint in key for hint in ("id", "Id", "ID")):
                args[key] = self._auto_find_id(context)

        context_arg = config.get("context_arg")
        if context_arg:
            args[str(context_arg)] = context

        return args

    @staticmethod
    def _auto_find_id(context: dict[str, Any]) -> Any:
        """Search upstream results for an 'id' field to auto-populate."""

        # Walk results in reverse order (most recent first)
        for node_id in reversed(list(context.keys())):
            node_result = context[node_id]
            if not isinstance(node_result, Mapping):
                continue
            result = node_result.get("result")
            if result is None:
                continue
            # If result is a list, get id from first element
            if isinstance(result, list) and result:
                first = result[0]
                if isinstance(first, Mapping) and "id" in first:
                    return str(first["id"])
            # If result is a dict with an id
            if isinstance(result, Mapping) and "id" in result:
                return str(result["id"])
        return None

    def _resolve_value(self, value: Any, context: dict[str, Any]) -> Any:
        """Resolve context references in nested argument values."""

        if isinstance(value, str):
            if value == "$context" or value == "{context}":
                return context
            if value.startswith("$context."):
                return self._lookup_context_path(context, value.removeprefix("$context."))
            return value
        if isinstance(value, list):
            return [self._resolve_value(item, context) for item in value]
        if isinstance(value, dict):
            return {key: self._resolve_value(item, context) for key, item in value.items()}
        return value

    @staticmethod
    def _lookup_context_path(context: dict[str, Any], path: str) -> Any:
        """Lookup a dotted path from upstream node context."""

        current: Any = context
        for part in path.split("."):
            if current is None:
                return None
            if isinstance(current, Mapping):
                if part in current:
                    current = current.get(part)
                elif part.isdigit():
                    # Numeric index on a dict — skip it (list was unwrapped to single item)
                    continue
                else:
                    return None
            elif isinstance(current, list) and part.isdigit():
                idx = int(part)
                if idx < len(current):
                    current = current[idx]
                else:
                    return None
            else:
                return None
        return current

    def _upstream_context(
        self,
        node_id: str,
        results_by_node: Mapping[str, NodeExecutionResult],
    ) -> dict[str, Any]:
        """Return outputs and errors from direct upstream nodes."""

        context: dict[str, Any] = {}
        for parent_id in self._parents[node_id]:
            parent_result = results_by_node.get(parent_id)
            if parent_result is None:
                continue
            context[parent_id] = {
                "status": parent_result["status"],
                "result": parent_result.get("result"),
                "error": parent_result.get("error"),
            }
        return context

    @staticmethod
    def _node_config(node: Mapping[str, Any]) -> dict[str, Any]:
        """Extract node config from common flow node shapes."""

        data = node.get("data")
        if isinstance(data, Mapping):
            config = data.get("config")
            if isinstance(config, Mapping):
                return dict(config)
            return dict(data)

        config = node.get("config")
        if isinstance(config, Mapping):
            return dict(config)

        return {}

    @staticmethod
    def _parse_type(node_type: str) -> tuple[str | None, str | None]:
        """Parse server and tool names from node type strings."""

        normalized = node_type.removeprefix("mcp:")
        for separator in (":", ".", "/"):
            if separator in normalized:
                server_name, tool_name = normalized.split(separator, 1)
                return server_name or None, tool_name or None
        return None, None

    @staticmethod
    def _normalize_nodes(nodes: Any) -> dict[str, Mapping[str, Any]]:
        """Normalize a list of node dicts into an id-indexed mapping."""

        if not isinstance(nodes, list):
            raise ValueError("Flow nodes must be a list")

        normalized: dict[str, Mapping[str, Any]] = {}
        for node in nodes:
            if not isinstance(node, Mapping) or "id" not in node:
                raise ValueError("Each flow node must be an object with an id")
            node_id = str(node["id"])
            if node_id in normalized:
                raise ValueError(f"Duplicate node id: {node_id}")
            normalized[node_id] = node
        return normalized

    @staticmethod
    def _normalize_edges(edges: Any) -> list[dict[str, str]]:
        """Normalize a list of flow edges into source/target pairs."""

        if not isinstance(edges, list):
            raise ValueError("Flow edges must be a list")

        normalized: list[dict[str, str]] = []
        for edge in edges:
            if not isinstance(edge, Mapping) or "source" not in edge or "target" not in edge:
                raise ValueError("Each flow edge must include source and target")
            normalized.append({"source": str(edge["source"]), "target": str(edge["target"])})
        return normalized

    @staticmethod
    def _continue_on_error(node_or_flow: Mapping[str, Any], default: bool = False) -> bool:
        """Return whether execution should continue after a node error."""

        config = node_or_flow.get("config")
        if isinstance(config, Mapping) and "continue_on_error" in config:
            return bool(config["continue_on_error"])

        data = node_or_flow.get("data")
        if isinstance(data, Mapping):
            data_config = data.get("config")
            if isinstance(data_config, Mapping) and "continue_on_error" in data_config:
                return bool(data_config["continue_on_error"])
            if "continue_on_error" in data:
                return bool(data["continue_on_error"])

        if "continue_on_error" in node_or_flow:
            return bool(node_or_flow["continue_on_error"])
        return default

    async def _emit(self, node_id: str, status: NodeStatus, result: Any) -> None:
        """Emit a node status update to an optional sync or async callback."""

        if self.on_node_update is None:
            return

        maybe_awaitable = self.on_node_update(node_id, status, result)
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable

    @staticmethod
    def _now() -> str:
        """Return the current UTC timestamp as an ISO string."""

        return datetime.now(UTC).isoformat()

