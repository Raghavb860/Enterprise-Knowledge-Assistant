# Enterprise Knowledge Assistant — API Documentation

Base URL: `http://localhost:8000/api/v1`
Auth: Bearer token in `Authorization` header  
Interactive docs: `http://localhost:8000/api/docs`

---

## Authentication

### POST /auth/register
Register a new user (assigned viewer role by default).

**Request body:**
```json
{
  "email": "jane@company.com",
  "username": "jane_doe",
  "full_name": "Jane Doe",
  "password": "MyPass@1",
  "department": "Finance"
}
```

**Response 201:**
```json
{ "message": "Registration successful", "user_id": "uuid" }
```

---

### POST /auth/login
Authenticate and receive tokens.

**Request body:**
```json
{ "email": "admin@eka.local", "password": "Admin@123" }
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user_id": "uuid",
  "username": "superadmin",
  "full_name": "System Administrator",
  "role": "super_admin",
  "permissions": ["documents:upload", "documents:read", "..."]
}
```

---

### POST /auth/refresh
Get a new access token using a valid refresh token.

**Request body:**
```json
{ "refresh_token": "abc123..." }
```

**Response 200:**
```json
{ "access_token": "eyJ...", "expires_in": 1800 }
```

---

### POST /auth/logout
Revoke the refresh token.

**Request body:**
```json
{ "refresh_token": "abc123..." }
```

---

### GET /auth/me
Get the current authenticated user's profile.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "admin@eka.local",
  "username": "superadmin",
  "full_name": "System Administrator",
  "department": null,
  "role": "super_admin",
  "permissions": ["documents:upload", "documents:read", "..."],
  "is_active": true,
  "last_login_at": "2025-01-01T10:00:00"
}
```

---

## Documents

### POST /documents/upload
Upload a document for indexing. Runs parsing + embedding in background.

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` (required): The document file
- `collection_id` (optional): UUID of a collection
- `department` (optional): Department name
- `description` (optional): Free text description

**Response 202:**
```json
{
  "document_id": "uuid",
  "filename": "Annual_Report_2024.pdf",
  "status": "pending",
  "message": "Upload accepted. Indexing in progress."
}
```

**Duplicate detection:** If the same file content (by SHA-256 hash) was already uploaded,
returns the existing document instead of re-indexing.

---

### GET /documents/
List documents with filtering and pagination.

**Query params:**
- `page` (default: 1)
- `page_size` (default: 20, max: 100)
- `collection_id`: Filter by collection UUID
- `department`: Filter by department name
- `status`: pending | processing | ready | failed
- `search`: Substring match on filename/title

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "original_name": "Annual_Report_2024.pdf",
      "file_type": "pdf",
      "file_size": 2457600,
      "title": "Annual Report 2024",
      "author": "Finance Team",
      "department": "Finance",
      "description": null,
      "page_count": 48,
      "word_count": 12400,
      "chunk_count": 92,
      "status": "ready",
      "tags": ["annual", "finance"],
      "collection_id": "uuid",
      "owner_id": "uuid",
      "created_at": "2025-01-15T09:00:00",
      "updated_at": "2025-01-15T09:02:30"
    }
  ],
  "total": 47,
  "page": 1,
  "page_size": 20
}
```

---

### GET /documents/{document_id}
Get a single document by ID.

---

### GET /documents/{document_id}/status
Poll document processing status. Use this for progress tracking after upload.

**Response 200:**
```json
{
  "document_id": "uuid",
  "status": "processing",
  "chunk_count": 0,
  "error_message": null
}
```

Status values: `pending` → `processing` → `ready` (or `failed`)

---

### DELETE /documents/{document_id}
Soft-delete a document and remove its vectors from ChromaDB.

Knowledge managers can only delete their own documents.
Admins and super admins can delete any document.

**Response 200:**
```json
{ "message": "Document 'Annual_Report_2024.pdf' deleted successfully." }
```

---

## Collections

### POST /collections/
Create a new collection.

**Request body:**
```json
{
  "name": "Finance Documents",
  "description": "Annual reports and financial statements",
  "department": "Finance",
  "color": "#3b82f6",
  "icon": "folder",
  "is_public": false
}
```

---

### GET /collections/
List all accessible collections (owned + public for non-admins).

---

### GET /collections/{collection_id}
Get a single collection.

---

### PUT /collections/{collection_id}
Update collection name, description, or visibility.

---

### DELETE /collections/{collection_id}
Delete a collection (documents are NOT deleted, just unlinked).

---

## Search

### POST /search/
Search across all indexed documents.

**Request body:**
```json
{
  "query": "What were the revenue figures for Q4 2024?",
  "search_type": "hybrid",
  "collection_id": "uuid",
  "department": "Finance",
  "n_results": 10
}
```

`search_type`: `"hybrid"` | `"semantic"` | `"keyword"`

**Response 200:**
```json
{
  "query": "What were the revenue figures for Q4 2024?",
  "results": [
    {
      "document_id": "uuid",
      "document_name": "Q4_Report_2024.pdf",
      "page_number": 12,
      "chunk_index": 45,
      "score": 0.92,
      "excerpt": "Q4 2024 revenue reached $4.2 billion, representing..."
    }
  ],
  "total": 8,
  "search_type": "hybrid",
  "elapsed_ms": 234
}
```

**Score interpretation:**
- 0.85–1.00: Excellent match
- 0.70–0.84: Good match
- 0.50–0.69: Moderate match
- < 0.50: Weak match

---

## Chat

### POST /chat/sessions
Create a new conversation session.

**Request body:**
```json
{
  "title": "Q4 Financial Analysis",
  "collection_id": "uuid",
  "model": "qwen3:8b"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "title": "Q4 Financial Analysis",
  "model_used": "qwen3:8b",
  "collection_id": "uuid",
  "message_count": 0,
  "is_archived": false,
  "created_at": "...",
  "updated_at": "..."
}
```

---

### GET /chat/sessions
List all non-archived sessions for the current user.

---

### GET /chat/sessions/{session_id}
Get a session with its full message history.

**Response includes:**
```json
{
  "id": "uuid",
  "title": "Q4 Financial Analysis",
  "messages": [
    {
      "id": "uuid",
      "session_id": "uuid",
      "role": "user",
      "content": "What was Q4 revenue?",
      "citations": null,
      "model_used": null,
      "response_time_ms": null,
      "created_at": "..."
    },
    {
      "id": "uuid",
      "session_id": "uuid",
      "role": "assistant",
      "content": "According to the Q4 Report [Doc: Q4_Report_2024.pdf, Page 12, Chunk 45], revenue reached...",
      "citations": [
        {
          "document_name": "Q4_Report_2024.pdf",
          "document_id": "uuid",
          "page_number": 12,
          "chunk_index": 45,
          "similarity_score": 0.92,
          "excerpt": "Q4 2024 revenue reached $4.2 billion..."
        }
      ],
      "model_used": "qwen3:8b",
      "response_time_ms": 4230,
      "created_at": "..."
    }
  ]
}
```

---

### POST /chat/message
Send a message and receive an AI response with citations.

**Request body:**
```json
{
  "session_id": "uuid",
  "message": "Summarise the key risks mentioned in the document.",
  "model": "qwen3:8b"
}
```

**Response 200:**
```json
{
  "message_id": "uuid",
  "answer": "The document identifies three key risks: [Doc: Risk_Report.pdf, Page 5, Chunk 12]\n1. Market volatility...",
  "citations": [
    {
      "document_name": "Risk_Report.pdf",
      "document_id": "uuid",
      "page_number": 5,
      "chunk_index": 12,
      "similarity_score": 0.89,
      "excerpt": "Key risks include market volatility, regulatory changes..."
    }
  ],
  "model_used": "qwen3:8b",
  "response_time_ms": 6800
}
```

**Guardrails:**
- If the answer is not in the documents, the model replies:
  "I could not find this information in the uploaded documents."
- Prompt injection attempts are rejected with HTTP 400.

---

### DELETE /chat/sessions/{session_id}
Archive a conversation (soft-delete, not removed from DB).

---

## Users (Admin only)

### GET /users/
List all users. Requires `users:read` permission.

### PUT /users/{user_id}
Update user role, department, or active status. Requires `users:update`.

### DELETE /users/{user_id}
Deactivate a user account. Requires `users:delete`.
Cannot deactivate your own account.

---

## Dashboard (Managers+)

### GET /dashboard/stats
Get aggregate system and AI usage metrics.

**Response 200:**
```json
{
  "total_documents": 234,
  "total_users": 18,
  "total_collections": 12,
  "total_searches_today": 47,
  "total_chats_today": 23,
  "avg_response_time_ms": 4200.5,
  "documents_by_type": {
    "pdf": 180,
    "docx": 40,
    "txt": 10,
    "xlsx": 4
  },
  "queries_per_day": [
    { "date": "2025-01-09", "count": 34 },
    { "date": "2025-01-10", "count": 47 }
  ]
}
```

---

## Audit Logs (Admin+)

### GET /audit/
Query the audit trail. Requires `audit:read` permission.

**Query params:**
- `page`, `page_size`
- `user_id`: Filter by user UUID
- `action`: Filter by action name

**Action values:**
- `user.login` — user authenticated
- `user.logout` — user logged out
- `document.upload` — file uploaded
- `document.delete` — file deleted
- `search.perform` — search query executed
- `chat.query` — AI chat message sent

**Response 200:**
```json
{
  "items": [
    {
      "id": 1,
      "user_id": "uuid",
      "action": "document.upload",
      "resource_type": "document",
      "resource_id": "uuid",
      "details": { "filename": "Q4_Report.pdf" },
      "ip_address": "127.0.0.1",
      "status": "success",
      "created_at": "2025-01-15T09:00:00"
    }
  ],
  "total": 892,
  "page": 1,
  "page_size": 50
}
```

---

## Error Responses

All endpoints return consistent error shapes:

```json
{ "detail": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| 400    | Bad request (validation error, duplicate, etc.) |
| 401    | Missing or invalid/expired access token |
| 403    | Valid token but insufficient permission |
| 404    | Resource not found |
| 413    | File too large (> 50 MB) |
| 415    | Unsupported file type |
| 422    | Request body validation failed |
| 429    | Rate limit exceeded |
| 500    | Internal server error |
