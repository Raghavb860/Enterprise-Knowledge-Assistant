# backend/app/schemas/auth.py
from pydantic import BaseModel, EmailStr, field_validator
import re


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int   # seconds
    user_id: str
    username: str
    full_name: str
    role: str
    permissions: list[str]


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    department: str | None = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]{3,30}$", v):
            raise ValueError("Username must be 3-30 chars: letters, digits, underscores only")
        return v


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    access_token: str
    expires_in: int


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordChangeRequest(BaseModel):
    token: str
    new_password: str


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/schemas/user.py
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel, EmailStr
from datetime import datetime


class RoleOut(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: str
    email: str
    username: str
    full_name: str
    department: str | None
    is_active: bool
    is_verified: bool
    last_login_at: datetime | None
    created_at: datetime
    role: RoleOut
    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    role_id: int
    department: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    department: str | None = None
    role_id: int | None = None
    is_active: bool | None = None


class UserListOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/schemas/document.py
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DocumentOut(BaseModel):
    id: str
    original_name: str
    file_type: str
    file_size: int
    title: str | None
    author: str | None
    department: str | None
    description: str | None
    page_count: int | None
    word_count: int | None
    chunk_count: int
    status: str
    tags: list[str] | None
    collection_id: str | None
    owner_id: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class DocumentCreate(BaseModel):
    collection_id: str | None = None
    department: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class DocumentListOut(BaseModel):
    items: list[DocumentOut]
    total: int
    page: int
    page_size: int


class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    status: str
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/schemas/collection.py
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel
from datetime import datetime


class CollectionOut(BaseModel):
    id: str
    name: str
    description: str | None
    department: str | None
    color: str | None
    icon: str | None
    is_public: bool
    doc_count: int
    owner_id: str
    created_at: datetime
    model_config = {"from_attributes": True}


class CollectionCreate(BaseModel):
    name: str
    description: str | None = None
    department: str | None = None
    color: str | None = None
    icon: str | None = None
    is_public: bool = False


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    department: str | None = None
    color: str | None = None
    is_public: bool | None = None


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/schemas/chat.py
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel
from datetime import datetime


class CitationOut(BaseModel):
    document_name: str
    document_id: str
    page_number: int
    chunk_index: int
    similarity_score: float
    excerpt: str


class ChatSessionOut(BaseModel):
    id: str
    title: str
    model_used: str
    collection_id: str | None
    message_count: int
    total_tokens: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ChatSessionCreate(BaseModel):
    title: str = "New Conversation"
    collection_id: str | None = None
    model: str = "qwen3:8b"


class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    citations: list[CitationOut] | None
    model_used: str | None
    response_time_ms: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    session_id: str
    message: str
    model: str | None = None


class ChatResponse(BaseModel):
    message_id: str
    answer: str
    citations: list[CitationOut]
    model_used: str
    response_time_ms: int


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/schemas/search.py
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel
from datetime import datetime


class SearchRequest(BaseModel):
    query: str
    search_type: str = "hybrid"   # semantic | keyword | hybrid
    collection_id: str | None = None
    department: str | None = None
    tags: list[str] | None = None
    n_results: int = 10


class SearchResultOut(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    chunk_index: int
    score: float
    excerpt: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultOut]
    total: int
    search_type: str
    elapsed_ms: int


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/schemas/audit.py
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel
from datetime import datetime


class AuditLogOut(BaseModel):
    id: int
    user_id: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    details: dict | None
    ip_address: str | None
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class AuditListOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/schemas/dashboard.py
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_documents: int
    total_users: int
    total_collections: int
    total_searches_today: int
    total_chats_today: int
    avg_response_time_ms: float
    documents_by_type: dict[str, int]
    top_documents: list[dict]
    queries_per_day: list[dict]   # [{date, count}]
    most_active_users: list[dict]
