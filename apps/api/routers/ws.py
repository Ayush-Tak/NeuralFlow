import json
import logging
from collections import defaultdict, deque
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from agents.orchestrator import NeuralFlowAgent
from db.database import async_session_factory
from models.user import User
from services.auth_utils import verify_access_token
from services.mcp_client import MCPClientManager

router = APIRouter(tags=["websocket"])
logger = logging.getLogger(__name__)
_execution_subscribers: dict[str, set[WebSocket]] = defaultdict(set)


async def _authenticate_websocket(websocket: WebSocket) -> User | None:
    """Validate a websocket JWT query parameter and return the user."""

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    try:
        payload = verify_access_token(token)
        user_id = UUID(str(payload["sub"]))
    except (KeyError, ValueError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    async with async_session_factory() as db:
        user = await db.get(User, user_id)
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None
        return user


async def publish_execution_event(flow_id: str | UUID, payload: dict) -> None:
    """Publish an execution status event to connected websocket clients."""

    subscribers = set(_execution_subscribers.get(str(flow_id), set()))
    stale: list[WebSocket] = []
    for websocket in subscribers:
        try:
            await websocket.send_json({"type": "execution:update", "payload": payload})
        except RuntimeError:
            stale.append(websocket)

    for websocket in stale:
        _execution_subscribers[str(flow_id)].discard(websocket)


def _extract_chat_content(raw_message: str) -> str:
    """Extract chat content from raw text or a JSON websocket message."""

    try:
        message = json.loads(raw_message)
    except json.JSONDecodeError:
        return raw_message

    if isinstance(message, dict):
        payload = message.get("payload")
        if isinstance(payload, dict) and isinstance(payload.get("content"), str):
            return payload["content"]
        if isinstance(message.get("content"), str):
            return message["content"]

    return raw_message


async def _build_agent(
    user: User,
    websocket: WebSocket,
) -> NeuralFlowAgent:
    """Create a user-scoped chat agent for one websocket message."""

    client_manager = MCPClientManager(user=user)
    connected_integrations = client_manager.get_connected_integrations(user)
    tools = await client_manager.get_tools_for_user(user)

    async def emit_agent_event(event: dict) -> None:
        if event.get("type") != "tool_call":
            return
        await websocket.send_json(
            {
                "type": "chat:tool_call",
                "payload": {
                    "tool_name": event.get("tool_name"),
                    "server_name": event.get("server_name"),
                    "status": event.get("status"),
                    "result": event.get("result"),
                },
            }
        )

    return NeuralFlowAgent(
        available_tools=tools,
        connected_integrations=connected_integrations,
        event_callback=emit_agent_event,
    )


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket) -> None:
    """Accept authenticated chat messages and answer with the LangGraph agent."""

    user = await _authenticate_websocket(websocket)
    if user is None:
        return

    await websocket.accept()
    history: deque[BaseMessage] = deque(maxlen=20)

    try:
        while True:
            raw_message = await websocket.receive_text()
            user_message = _extract_chat_content(raw_message)
            await websocket.send_json(
                {
                    "type": "chat:message",
                    "payload": {"role": "user", "content": user_message},
                }
            )

            try:
                agent = await _build_agent(user, websocket)
                response = await agent.run(user_message, list(history))
                history.append(HumanMessage(content=user_message))
                history.append(AIMessage(content=response))
                await websocket.send_json(
                    {
                        "type": "chat:message",
                        "payload": {"role": "assistant", "content": response},
                    }
                )
            except Exception as exc:
                logger.exception("Chat agent failed")
                await websocket.send_json(
                    {"type": "chat:error", "payload": {"message": str(exc)}}
                )
    except WebSocketDisconnect:
        return


@router.websocket("/ws/execution/{flow_id}")
async def websocket_execution(websocket: WebSocket, flow_id: UUID) -> None:
    """Accept an authenticated websocket for flow execution status streaming."""

    user = await _authenticate_websocket(websocket)
    if user is None:
        return

    await websocket.accept()
    _execution_subscribers[str(flow_id)].add(websocket)
    await websocket.send_json(
        {
            "type": "execution.connected",
            "payload": {
                "flow_id": str(flow_id),
                "user_id": str(user.id),
                "status": "connected",
            },
        }
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _execution_subscribers[str(flow_id)].discard(websocket)
        return
