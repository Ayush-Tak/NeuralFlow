from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.database import Base


class FlowStatus(StrEnum):
    """Lifecycle status for a flow."""

    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


class Flow(Base):
    """User-owned automation flow definition."""

    __tablename__ = "flows"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[FlowStatus] = mapped_column(
        Enum(
            FlowStatus,
            name="flow_status",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=FlowStatus.DRAFT,
        nullable=False,
    )
    nodes: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    edges: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    schedule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="flows")
    executions = relationship("FlowExecution", back_populates="flow", cascade="all, delete-orphan")
