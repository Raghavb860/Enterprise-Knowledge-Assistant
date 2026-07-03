# backend/app/db/models/job.py
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Enum as SAEnum, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, generate_uuid
import enum


class JobType(str, enum.Enum):
    PARSE   = "parse"
    EMBED   = "embed"
    REINDEX = "reindex"


class JobStatus(str, enum.Enum):
    QUEUED  = "queued"
    RUNNING = "running"
    DONE    = "done"
    FAILED  = "failed"


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_type: Mapped[JobType] = mapped_column(
        SAEnum(JobType, values_callable=lambda obj: [e.value for e in obj]), default=JobType.PARSE, nullable=False
    )
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus, values_callable=lambda obj: [e.value for e in obj]), default=JobStatus.QUEUED, nullable=False, index=True
    )
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    document: Mapped["Document"] = relationship("Document", back_populates="processing_jobs")
