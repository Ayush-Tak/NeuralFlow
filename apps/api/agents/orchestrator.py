import inspect
import json
import logging
from collections.abc import Awaitable, Callable, Iterable, Sequence
from typing import Any, Literal, NotRequired, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph

from agents.prompts import build_system_prompt
from config import settings

logger = logging.getLogger(__name__)
KNOWN_SERVER_NAMES = ("google-calendar", "gmail", "github")

AgentEventCallback = Callable[[dict[str, Any]], None | Awaitable[None]]


class ToolCall(TypedDict):
    """Normalized tool call requested by the LLM."""

    id: str
    name: str
    args: dict[str, Any]
    server_name: NotRequired[str | None]
    tool_name: NotRequired[str | None]


class ToolResult(TypedDict):
    """Result produced by an MCP tool invocation."""

    tool_call_id: str
    name: str
    result: Any
    error: str | None


class AgentState(TypedDict):
    """LangGraph state for NeuralFlow chat orchestration."""

    messages: list[BaseMessage]
    tool_calls: list[ToolCall]
    tool_results: list[ToolResult]


class NeuralFlowAgent:
    """LangGraph ReAct-style agent that plans, calls MCP tools, and responds."""

    def __init__(
        self,
        available_tools: Sequence[BaseTool],
        connected_integrations: Iterable[str],
        event_callback: AgentEventCallback | None = None,
    ) -> None:
        """Initialize the agent with user-scoped MCP tools."""

        self.available_tools = list(available_tools)
        self.connected_integrations = list(connected_integrations)
        self.event_callback = event_callback
        self.tools_by_name = {tool.name: tool for tool in self.available_tools}
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=settings.groq_api_key,
            temperature=0,
        )
        self.tool_bound_llm = (
            self.llm.bind_tools(self.available_tools) if self.available_tools else self.llm
        )
        self.graph = self._build_graph()

    async def run(self, user_message: str, history: Sequence[BaseMessage] | None = None) -> str:
        """Run the agent for one user message and return the final response."""

        messages = list(history or [])
        messages.append(HumanMessage(content=user_message))
        final_state = await self.graph.ainvoke(
            {"messages": messages, "tool_calls": [], "tool_results": []}
        )
        final_message = final_state["messages"][-1]
        return self._message_content(final_message)

    def _build_graph(self) -> Any:
        """Build the router/tool/responder LangGraph workflow."""

        graph = StateGraph(AgentState)
        graph.add_node("router", self._router)
        graph.add_node("tool_executor", self._tool_executor)
        graph.add_node("responder", self._responder)
        graph.add_edge(START, "router")
        graph.add_conditional_edges(
            "router",
            self._route_after_router,
            {"tool_executor": "tool_executor", "responder": "responder"},
        )
        graph.add_edge("tool_executor", "responder")
        graph.add_edge("responder", END)
        return graph.compile()

    async def _router(self, state: AgentState) -> dict[str, Any]:
        """Decide whether the user request needs tool execution."""

        messages = [SystemMessage(content=build_system_prompt(self.connected_integrations))]
        messages.extend(state["messages"])
        response = await self.tool_bound_llm.ainvoke(messages)
        tool_calls = self._normalize_tool_calls(response)
        return {"messages": state["messages"] + [response], "tool_calls": tool_calls}

    @staticmethod
    def _route_after_router(state: AgentState) -> Literal["tool_executor", "responder"]:
        """Route to the tool executor only when the LLM requested a tool."""

        return "tool_executor" if state.get("tool_calls") else "responder"

    async def _tool_executor(self, state: AgentState) -> dict[str, Any]:
        """Execute requested tools and append ToolMessages to the conversation."""

        tool_messages: list[ToolMessage] = []
        tool_results: list[ToolResult] = []

        for tool_call in state["tool_calls"]:
            tool = self.tools_by_name.get(tool_call["name"])
            server_name, tool_name = self._split_tool_name(tool_call["name"])
            await self._emit(
                {
                    "type": "tool_call",
                    "tool_name": tool_name,
                    "server_name": server_name,
                    "status": "calling",
                }
            )

            if tool is None:
                error = f"Tool is not available: {tool_call['name']}"
                result_text = error
                tool_result: ToolResult = {
                    "tool_call_id": tool_call["id"],
                    "name": tool_call["name"],
                    "result": None,
                    "error": error,
                }
            else:
                try:
                    result = await tool.ainvoke(tool_call["args"])
                    result_text = self._stringify(result)
                    tool_result = {
                        "tool_call_id": tool_call["id"],
                        "name": tool_call["name"],
                        "result": result,
                        "error": None,
                    }
                    await self._emit(
                        {
                            "type": "tool_call",
                            "tool_name": tool_name,
                            "server_name": server_name,
                            "status": "success",
                            "result": result_text,
                        }
                    )
                except Exception as exc:
                    logger.exception("MCP tool call failed: %s", tool_call["name"])
                    result_text = f"Tool error: {exc}"
                    tool_result = {
                        "tool_call_id": tool_call["id"],
                        "name": tool_call["name"],
                        "result": None,
                        "error": str(exc),
                    }
                    await self._emit(
                        {
                            "type": "tool_call",
                            "tool_name": tool_name,
                            "server_name": server_name,
                            "status": "error",
                            "result": result_text,
                        }
                    )

            tool_results.append(tool_result)
            tool_messages.append(
                ToolMessage(content=result_text, tool_call_id=tool_call["id"])
            )

        return {
            "messages": state["messages"] + tool_messages,
            "tool_results": state["tool_results"] + tool_results,
        }

    async def _responder(self, state: AgentState) -> dict[str, Any]:
        """Generate the final natural language answer."""

        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and not state.get("tool_results"):
            return {"messages": state["messages"]}

        messages = [
            SystemMessage(
                content=(
                    f"{build_system_prompt(self.connected_integrations)}\n\n"
                    "Use the tool results above to answer the user directly."
                )
            )
        ]
        messages.extend(state["messages"])
        response = await self.llm.ainvoke(messages)
        return {"messages": state["messages"] + [response]}

    def _normalize_tool_calls(self, response: BaseMessage) -> list[ToolCall]:
        """Normalize tool calls from a LangChain AIMessage."""

        raw_calls = getattr(response, "tool_calls", None) or []
        calls: list[ToolCall] = []
        for index, raw_call in enumerate(raw_calls):
            name = str(raw_call.get("name") or "")
            args = raw_call.get("args") or {}
            if not isinstance(args, dict):
                args = {}
            server_name, tool_name = self._split_tool_name(name)
            calls.append(
                {
                    "id": str(raw_call.get("id") or f"tool-call-{index}"),
                    "name": name,
                    "args": args,
                    "server_name": server_name,
                    "tool_name": tool_name,
                }
            )
        return calls

    @staticmethod
    def _split_tool_name(name: str) -> tuple[str | None, str]:
        """Infer server and tool names from prefixed MCP tool names."""

        for server_name in KNOWN_SERVER_NAMES:
            for separator in ("__", "_", ".", ":"):
                prefix = f"{server_name}{separator}"
                if name.startswith(prefix):
                    return server_name, name.removeprefix(prefix)
        return None, name

    async def _emit(self, event: dict[str, Any]) -> None:
        """Emit an intermediate agent event."""

        if self.event_callback is None:
            return
        maybe_awaitable = self.event_callback(event)
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable

    @staticmethod
    def _message_content(message: BaseMessage) -> str:
        """Convert a LangChain message content field to text."""

        content = getattr(message, "content", "")
        if isinstance(content, str):
            return content
        return NeuralFlowAgent._stringify(content)

    @staticmethod
    def _stringify(value: Any) -> str:
        """Serialize arbitrary tool output for chat display."""

        if isinstance(value, str):
            return value
        try:
            return json.dumps(value, default=str)
        except TypeError:
            return str(value)
