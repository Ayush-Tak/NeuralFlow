import asyncio
import json
import logging
from collections.abc import Sequence
from datetime import UTC
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func as sa_func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import async_session_factory, get_db
from engine.executor import WorkflowExecutor
from models.execution import FlowExecution, FlowExecutionStatus
from models.flow import Flow, FlowStatus
from models.user import User
from routers.auth import get_current_user
from routers.ws import publish_execution_event
from services.mcp_client import MCPClientManager

router = APIRouter(prefix="/flows", tags=["flows"])
logger = logging.getLogger(__name__)


class FlowCreate(BaseModel):
    """Request payload for creating a flow."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: FlowStatus = FlowStatus.DRAFT
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    schedule: str | None = None


class FlowUpdate(BaseModel):
    """Request payload for updating a flow."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: FlowStatus | None = None
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None
    schedule: str | None = None


class FlowResponse(BaseModel):
    """Response payload for a flow."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    description: str | None
    status: FlowStatus
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    schedule: str | None
    created_at: datetime
    updated_at: datetime
    execution_count: int = 0


class FlowExecutionResponse(BaseModel):
    """Response payload returned after starting flow execution."""

    execution_id: UUID


async def _get_user_flow(db: AsyncSession, flow_id: UUID, user_id: UUID) -> Flow:
    """Fetch a flow owned by a user or raise 404."""

    result = await db.execute(select(Flow).where(Flow.id == flow_id, Flow.user_id == user_id))
    flow = result.scalar_one_or_none()
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    return flow


@router.post("", response_model=FlowResponse, status_code=status.HTTP_201_CREATED)
async def create_flow(
    payload: FlowCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Flow:
    """Create a flow for the authenticated user."""

    flow = Flow(user_id=current_user.id, **payload.model_dump())
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return flow


@router.get("", response_model=list[FlowResponse])
async def list_flows(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict[str, Any]]:
    """List flows owned by the authenticated user with execution counts."""

    result = await db.execute(
        select(Flow)
        .options(selectinload(Flow.executions))
        .where(Flow.user_id == current_user.id)
        .order_by(Flow.created_at.desc())
    )
    flows = list(result.scalars().all())
    return [
        {
            **{c.name: getattr(f, c.name) for c in Flow.__table__.columns},
            "execution_count": len(f.executions) if f.executions else 0,
        }
        for f in flows
    ]


@router.get("/{flow_id}", response_model=FlowResponse)
async def get_flow(
    flow_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Flow:
    """Return a single flow owned by the authenticated user."""

    return await _get_user_flow(db, flow_id, current_user.id)


@router.put("/{flow_id}", response_model=FlowResponse)
async def update_flow(
    flow_id: UUID,
    payload: FlowUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Flow:
    """Update a flow owned by the authenticated user."""

    flow = await _get_user_flow(db, flow_id, current_user.id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(flow, field, value)

    await db.commit()
    await db.refresh(flow)
    return flow


@router.post("/{flow_id}/execute", response_model=FlowExecutionResponse)
async def execute_flow(
    flow_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FlowExecutionResponse:
    """Start workflow execution for a flow owned by the authenticated user."""

    flow = await _get_user_flow(db, flow_id, current_user.id)
    execution = FlowExecution(
        flow_id=flow.id,
        status=FlowExecutionStatus.RUNNING,
        node_results={},
        triggered_by=str(current_user.id),
        started_at=datetime.now(UTC),
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    flow_payload = {
        "id": str(flow.id),
        "nodes": flow.nodes,
        "edges": flow.edges,
        "continue_on_error": False,
    }
    asyncio.create_task(
        _run_flow_execution(
            execution_id=execution.id,
            flow_id=flow.id,
            user_id=current_user.id,
            flow_payload=flow_payload,
        )
    )
    return FlowExecutionResponse(execution_id=execution.id)


@router.get("/{flow_id}/executions/{execution_id}")
async def get_execution(
    flow_id: UUID,
    execution_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get execution status and results."""

    await _get_user_flow(db, flow_id, current_user.id)
    execution = await db.get(FlowExecution, execution_id)
    if execution is None or execution.flow_id != flow_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution not found")

    return {
        "id": str(execution.id),
        "flow_id": str(execution.flow_id),
        "status": execution.status.value,
        "node_results": execution.node_results,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
    }


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(
    flow_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a flow owned by the authenticated user."""

    flow = await _get_user_flow(db, flow_id, current_user.id)
    await db.delete(flow)
    await db.commit()


async def _run_flow_execution(
    *,
    execution_id: UUID,
    flow_id: UUID,
    user_id: UUID,
    flow_payload: dict[str, Any],
) -> None:
    """Run a flow in the background and persist execution results."""

    async with async_session_factory() as db:
        execution = await db.get(FlowExecution, execution_id)
        user = await db.get(User, user_id)
        if execution is None or user is None:
            logger.error("Cannot run flow execution %s: missing execution or user", execution_id)
            return

        async def on_node_update(node_id: str, node_status: str, result: Any) -> None:
            await publish_execution_event(
                flow_id,
                {
                    "execution_id": str(execution_id),
                    "flow_id": str(flow_id),
                    "node_id": node_id,
                    "status": node_status,
                    "result": _json_safe(result),
                },
            )

        try:
            await publish_execution_event(
                flow_id,
                {
                    "execution_id": str(execution_id),
                    "flow_id": str(flow_id),
                    "status": "running",
                },
            )
            executor = WorkflowExecutor(
                flow_payload,
                mcp_client=MCPClientManager(user=user),
                on_node_update=on_node_update,
            )
            results = await executor.execute()
            has_error = any(result["status"] == "error" for result in results)
            execution.status = (
                FlowExecutionStatus.FAILED if has_error else FlowExecutionStatus.COMPLETED
            )
            execution.node_results = {"results": _json_safe(results)}
            execution.completed_at = datetime.now(UTC)
            await db.commit()
            await publish_execution_event(
                flow_id,
                {
                    "execution_id": str(execution_id),
                    "flow_id": str(flow_id),
                    "status": execution.status.value,
                    "results": _json_safe(results),
                },
            )
        except Exception as exc:
            logger.exception("Flow execution failed: %s", execution_id)
            execution.status = FlowExecutionStatus.FAILED
            execution.node_results = {"error": str(exc)}
            execution.completed_at = datetime.now(UTC)
            await db.commit()
            await publish_execution_event(
                flow_id,
                {
                    "execution_id": str(execution_id),
                    "flow_id": str(flow_id),
                    "status": "failed",
                    "error": str(exc),
                },
            )


def _json_safe(value: Any) -> Any:
    """Convert arbitrary execution data into JSON-serializable values."""

    return json.loads(json.dumps(value, default=str))
