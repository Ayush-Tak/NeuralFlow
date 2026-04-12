from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.database import Base


class FlowExecutionStatus(StrEnum):
    """Runtime status for a flow execution."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FlowExecution(Base):
    """Execution record for a flow run."""

    __tablename__ = "flow_executions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    flow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("flows.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[FlowExecutionStatus] = mapped_column(
        Enum(
            FlowExecutionStatus,
            name="flow_execution_status",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=FlowExecutionStatus.PENDING,
        nullable=False,
    )
    node_results: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    triggered_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    flow = relationship("Flow", back_populates="executions")
