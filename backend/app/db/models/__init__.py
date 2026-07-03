# backend/app/db/models/__init__.py
# Re-export all models for Alembic to discover

from .user import User, UserSession
from .role import Role, Permission, RolePermission
from .document import Document, DocumentChunk, DocumentPermission
from .collection import Collection
from .chat import ChatSession, ChatMessage
from .audit import AuditLog
from .job import ProcessingJob
from .base import Base

__all__ = [
    "Base",
    "User", "UserSession",
    "Role", "Permission", "RolePermission",
    "Document", "DocumentChunk", "DocumentPermission",
    "Collection",
    "ChatSession", "ChatMessage",
    "AuditLog",
    "ProcessingJob",
]
