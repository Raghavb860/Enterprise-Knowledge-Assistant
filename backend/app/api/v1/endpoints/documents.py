# backend/app/api/v1/endpoints/documents.py
"""
Document endpoints:
  POST /upload      - upload + trigger indexing (background task)
  GET  /            - list documents
  GET  /{id}        - get one document
  DELETE /{id}      - soft-delete document
  GET  /{id}/status - processing status
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.document import Document, FileType, DocumentStatus
from app.db.models.user import User
from app.services.document.validator import validate_upload
from app.services.document.indexer import index_document, remove_document_from_index
from app.services.audit_service import audit_upload, audit_delete
from app.core.dependencies import get_current_user, require_permission
from app.core.config import settings
from fastapi import Request

router = APIRouter(prefix="/documents", tags=["Documents"])


def _save_file(content: bytes, filename: str) -> str:
    """Save bytes to upload dir, return absolute path."""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / filename
    path.write_bytes(content)
    return str(path)


from app.services.document.worker import new_document_event


@router.post("/upload", status_code=202)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    collection_id: str | None = None,
    department: str | None = None,
    description: str | None = None,
    current_user: User = Depends(require_permission("documents:upload")),
    db: Session = Depends(get_db),
):
    content, ext = await validate_upload(file)

    # Compute hash before saving (duplicate detection)
    import hashlib
    file_hash = hashlib.sha256(content).hexdigest()
    existing = db.query(Document).filter_by(file_hash=file_hash, is_deleted=False).first()
    if existing:
        return {
            "document_id": existing.id,
            "filename": existing.original_name,
            "status": existing.status.value,
            "message": "Duplicate document — already indexed.",
        }

    # Save to disk
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    storage_path = _save_file(content, unique_name)

    doc = Document(
        filename=unique_name,
        original_name=file.filename,
        file_type=FileType(ext),
        file_size=len(content),
        file_hash=file_hash,
        storage_path=storage_path,
        collection_id=collection_id,
        department=department,
        description=description,
        owner_id=current_user.id,
        status=DocumentStatus.PENDING,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    audit_upload(db, current_user.id, doc.id, file.filename, request)

    # Start indexing in background thread
    new_document_event.set()

    return {
        "document_id": doc.id,
        "filename": doc.original_name,
        "status": doc.status.value,
        "message": "Upload accepted. Indexing in progress.",
    }


@router.get("/")
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    collection_id: str | None = None,
    department: str | None = None,
    status: str | None = None,
    search: str | None = None,
    current_user: User = Depends(require_permission("documents:read")),
    db: Session = Depends(get_db),
):
    query = db.query(Document).filter(Document.is_deleted == False)

    # Non-admins only see their own docs + public collection docs
    if current_user.role.name not in ("super_admin", "admin", "knowledge_manager"):
        query = query.filter(Document.owner_id == current_user.id)

    if collection_id:
        query = query.filter(Document.collection_id == collection_id)
    if department:
        query = query.filter(Document.department == department)
    if status:
        query = query.filter(Document.status == status)
    if search:
        query = query.filter(Document.original_name.contains(search))

    total = query.count()
    docs = query.order_by(Document.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [_doc_to_dict(d) for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{document_id}")
def get_document(
    document_id: str,
    current_user: User = Depends(require_permission("documents:read")),
    db: Session = Depends(get_db),
):
    doc = _get_or_404(db, document_id)
    return _doc_to_dict(doc)


@router.get("/{document_id}/status")
def get_document_status(
    document_id: str,
    current_user: User = Depends(require_permission("documents:read")),
    db: Session = Depends(get_db),
):
    doc = _get_or_404(db, document_id)
    return {
        "document_id": doc.id,
        "status": doc.status.value,
        "chunk_count": doc.chunk_count,
        "error_message": doc.error_message,
    }


@router.delete("/{document_id}", status_code=200)
def delete_document(
    document_id: str,
    request: Request,
    current_user: User = Depends(require_permission("documents:delete")),
    db: Session = Depends(get_db),
):
    doc = _get_or_404(db, document_id)

    # Knowledge managers can only delete their own docs
    if current_user.role.name == "knowledge_manager" and doc.owner_id != current_user.id:
        raise HTTPException(403, "Cannot delete another user's document")

    # Remove from vector store
    try:
        remove_document_from_index(db, doc)
    except Exception:
        pass  # still soft-delete even if chroma cleanup fails

    doc.is_deleted = True
    doc.deleted_at = datetime.now(timezone.utc)
    db.commit()

    audit_delete(db, current_user.id, doc.id, doc.original_name, request)
    return {"message": f"Document '{doc.original_name}' deleted successfully."}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, document_id: str) -> Document:
    doc = db.query(Document).filter_by(id=document_id, is_deleted=False).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


def _doc_to_dict(doc: Document) -> dict:
    return {
        "id": doc.id,
        "original_name": doc.original_name,
        "file_type": doc.file_type.value,
        "file_size": doc.file_size,
        "title": doc.title,
        "author": doc.author,
        "department": doc.department,
        "description": doc.description,
        "page_count": doc.page_count,
        "word_count": doc.word_count,
        "chunk_count": doc.chunk_count,
        "status": doc.status.value,
        "tags": doc.tags or [],
        "collection_id": doc.collection_id,
        "owner_id": doc.owner_id,
        "created_at": doc.created_at.isoformat(),
        "updated_at": doc.updated_at.isoformat(),
    }
