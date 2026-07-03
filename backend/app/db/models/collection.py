# backend/app/db/models/collection.py
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin, generate_uuid


class Collection(Base, TimestampMixin):
    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(7))
    icon: Mapped[str | None] = mapped_column(String(50))
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    doc_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="collections")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="collection")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="collection"
    )
