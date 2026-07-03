# backend/app/schemas/__init__.py
# Re-export all schemas

from .auth import (
    LoginRequest, LoginResponse, RegisterRequest,
    TokenRefreshRequest, TokenRefreshResponse,
    PasswordResetRequest, PasswordChangeRequest,
)
from .user import UserOut, UserCreate, UserUpdate, UserListOut
from .document import DocumentOut, DocumentCreate, DocumentListOut, DocumentUploadResponse
from .collection import CollectionOut, CollectionCreate, CollectionUpdate
from .chat import (
    ChatSessionOut, ChatSessionCreate,
    ChatMessageOut, ChatRequest, ChatResponse,
)
from .search import SearchRequest, SearchResultOut, SearchResponse
from .audit import AuditLogOut, AuditListOut
from .dashboard import DashboardStats
