# backend/app/db/models/audit.py
from datetime import datetime
from sqlalchemy import String, Text, BigInteger, DateTime, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
import enum


class AuditStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILURE = "failure"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str | None] = mapped_column(String(50))
    resource_id: Mapped[str | None] = mapped_column(String(36))
    details: Mapped[dict | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    status: Mapped[AuditStatus] = mapped_column(
    SAEnum(
        AuditStatus,
        values_callable=lambda x: [e.value for e in x]
    ),
    default=AuditStatus.SUCCESS,
    nullable=False
)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped["User | None"] = relationship("User", back_populates="audit_logs")


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/db/models/job.py
# ─────────────────────────────────────────────────────────────────────────────
