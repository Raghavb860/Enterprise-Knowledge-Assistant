# backend/app/db/models/document.py
from datetime import datetime
from sqlalchemy import (
    String, Text, BigInteger, Integer, Boolean, DateTime,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin, generate_uuid
import enum


class FileType(str, enum.Enum):
    PDF  = "pdf"
    DOCX = "docx"
    TXT  = "txt"
    XLSX = "xlsx"


class DocumentStatus(str, enum.Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    READY      = "ready"
    FAILED     = "failed"


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[FileType] = mapped_column(
    SAEnum(
        FileType,
        values_callable=lambda obj: [e.value for e in obj]
    ),
    nullable=False
)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500))
    author: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int | None] = mapped_column(Integer)
    word_count: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str] = mapped_column(String(10), default="en")
    collection_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("collections.id", ondelete="SET NULL"), index=True
    )
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    status: Mapped[DocumentStatus] = mapped_column(
    SAEnum(
        DocumentStatus,
        values_callable=lambda obj: [e.value for e in obj]
    ),
    default=DocumentStatus.PENDING,
    nullable=False
)
    error_message: Mapped[str | None] = mapped_column(Text)
    chroma_collection: Mapped[str | None] = mapped_column(String(100))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)
    tags: Mapped[list | None] = mapped_column(JSON)
    custom_metadata: Mapped[dict | None] = mapped_column(JSON)

    # Relationships
    owner: Mapped["User"] = relationship(
        "User", back_populates="documents", foreign_keys=[owner_id]
    )
    collection: Mapped["Collection | None"] = relationship(
        "Collection", back_populates="documents"
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )
    permissions: Mapped[list["DocumentPermission"]] = relationship(
        "DocumentPermission", back_populates="document", cascade="all, delete-orphan"
    )
    processing_jobs: Mapped[list["ProcessingJob"]] = relationship(
        "ProcessingJob", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    char_count: Mapped[int] = mapped_column(Integer, nullable=False)
    token_estimate: Mapped[int | None] = mapped_column(Integer)
    chroma_chunk_id: Mapped[str | None] = mapped_column(String(100), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    document: Mapped[Document] = relationship("Document", back_populates="chunks")


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    can_read: Mapped[bool] = mapped_column(Boolean, default=True)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)
    granted_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    granted_at: Mapped[datetime] = mapped_column(DateTime)

    document: Mapped[Document] = relationship("Document", back_populates="permissions")
