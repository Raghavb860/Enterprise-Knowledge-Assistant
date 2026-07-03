# backend/app/api/v1/endpoints/search.py
"""Hybrid/semantic/keyword search endpoints."""
import time
from datetime import datetime, date, timedelta, timezone
from fastapi import APIRouter, Depends, Request, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.user import User
from app.services.rag.search import SearchQuery, run_search
from app.services.audit_service import audit_search
from app.core.dependencies import require_permission
from app.core.config import settings

router = APIRouter(prefix="/search", tags=["Search"])

try:
    from app.services.document.indexer import GLOBAL_COLLECTION
except ImportError:
    GLOBAL_COLLECTION = f"{settings.CHROMA_COLLECTION_PREFIX}_global"


@router.post("/")
def search(
    payload: dict,
    request: Request,
    current_user: User = Depends(require_permission("search:perform")),
    db: Session = Depends(get_db),
):
    query_text = payload.get("query", "").strip()
    if not query_text:
        return {"query": "", "results": [], "total": 0, "search_type": "hybrid", "elapsed_ms": 0}

    search_type = payload.get("search_type", "hybrid")
    n_results = min(int(payload.get("n_results", 10)), 50)
    department = payload.get("department")
    collection_id = payload.get("collection_id")

    # Build ChromaDB where filter
    where: dict | None = None
    filters = {}
    if department:
        filters["department"] = department
    if collection_id:
        filters["collection_id"] = collection_id
    if filters:
        where = {"$and": [{k: {"$eq": v}} for k, v in filters.items()]} if len(filters) > 1 else {
            list(filters.keys())[0]: {"$eq": list(filters.values())[0]}
        }

    t0 = time.monotonic()
    search_query = SearchQuery(
        text=query_text,
        collection_name=GLOBAL_COLLECTION,
        n_results=n_results,
        search_type=search_type,
        where_filter=where,
    )
    results = run_search(search_query)
    elapsed = int((time.monotonic() - t0) * 1000)

    audit_search(db, current_user.id, query_text, len(results), request)

    return {
        "query": query_text,
        "results": [
            {
                "document_id": r.metadata.get("document_id", ""),
                "document_name": r.metadata.get("original_name", ""),
                "page_number": r.metadata.get("page_number", 0),
                "chunk_index": r.metadata.get("chunk_index", 0),
                "score": r.score,
                "excerpt": r.content[:500],
            }
            for r in results
        ],
        "total": len(results),
        "search_type": search_type,
        "elapsed_ms": elapsed,
    }


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/api/v1/endpoints/collections.py
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.models.collection import Collection

collections_router = APIRouter(prefix="/collections", tags=["Collections"])


@collections_router.post("/", status_code=201)
def create_collection(
    payload: dict,
    current_user: User = Depends(require_permission("collections:create")),
    db: Session = Depends(get_db),
):
    col = Collection(
        name=payload["name"],
        description=payload.get("description"),
        department=payload.get("department"),
        color=payload.get("color"),
        icon=payload.get("icon"),
        is_public=payload.get("is_public", False),
        owner_id=current_user.id,
    )
    db.add(col)
    db.commit()
    db.refresh(col)
    return _col_to_dict(col)


@collections_router.get("/")
def list_collections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("collections:read")),
    db: Session = Depends(get_db),
):
    q = db.query(Collection)
    if current_user.role.name not in ("super_admin", "admin"):
        q = q.filter((Collection.owner_id == current_user.id) | (Collection.is_public == True))
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_col_to_dict(c) for c in items], "total": total, "page": page, "page_size": page_size}


@collections_router.get("/{collection_id}")
def get_collection(
    collection_id: str,
    current_user: User = Depends(require_permission("collections:read")),
    db: Session = Depends(get_db),
):
    col = db.query(Collection).filter_by(id=collection_id).first()
    if not col:
        raise HTTPException(404, "Collection not found")
    return _col_to_dict(col)


@collections_router.put("/{collection_id}")
def update_collection(
    collection_id: str,
    payload: dict,
    current_user: User = Depends(require_permission("collections:update")),
    db: Session = Depends(get_db),
):
    col = db.query(Collection).filter_by(id=collection_id).first()
    if not col:
        raise HTTPException(404, "Collection not found")
    for k, v in payload.items():
        if hasattr(col, k):
            setattr(col, k, v)
    db.commit()
    db.refresh(col)
    return _col_to_dict(col)


@collections_router.delete("/{collection_id}")
def delete_collection(
    collection_id: str,
    current_user: User = Depends(require_permission("collections:delete")),
    db: Session = Depends(get_db),
):
    col = db.query(Collection).filter_by(id=collection_id).first()
    if not col:
        raise HTTPException(404, "Collection not found")
    db.delete(col)
    db.commit()
    return {"message": "Collection deleted"}


def _col_to_dict(col: Collection) -> dict:
    return {
        "id": col.id, "name": col.name, "description": col.description,
        "department": col.department, "color": col.color, "icon": col.icon,
        "is_public": col.is_public, "doc_count": col.doc_count,
        "owner_id": col.owner_id, "created_at": col.created_at.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/api/v1/endpoints/users.py
# ─────────────────────────────────────────────────────────────────────────────
users_router = APIRouter(prefix="/users", tags=["Users"])


@users_router.get("/")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("users:read")),
    db: Session = Depends(get_db),
):
    from app.db.models.user import User as UserModel
    q = db.query(UserModel)
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": u.id, "email": u.email, "username": u.username,
                "full_name": u.full_name, "department": u.department,
                "is_active": u.is_active, "role": u.role.name,
                "created_at": u.created_at.isoformat(),
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            }
            for u in items
        ],
        "total": total, "page": page, "page_size": page_size,
    }


@users_router.put("/{user_id}")
def update_user(
    user_id: str,
    payload: dict,
    current_user: User = Depends(require_permission("users:update")),
    db: Session = Depends(get_db),
):
    from app.db.models.user import User as UserModel
    user = db.query(UserModel).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    for k, v in payload.items():
        if k in ("full_name", "department", "role_id", "is_active"):
            setattr(user, k, v)
    db.commit()
    return {"message": "User updated"}


@users_router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: User = Depends(require_permission("users:delete")),
    db: Session = Depends(get_db),
):
    from app.db.models.user import User as UserModel
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot delete your own account")
    user = db.query(UserModel).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = False
    db.commit()
    return {"message": "User deactivated"}


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/api/v1/endpoints/dashboard.py
# ─────────────────────────────────────────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(require_permission("dashboard:view")),
    db: Session = Depends(get_db),
):
    from app.db.models.document import Document as DocModel
    from app.db.models.user import User as UserModel
    from app.db.models.collection import Collection as ColModel
    from app.db.models.audit import AuditLog
    from sqlalchemy import func, and_

    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    total_docs = db.query(func.count(DocModel.id)).filter_by(is_deleted=False).scalar()
    total_users = db.query(func.count(UserModel.id)).filter_by(is_active=True).scalar()
    total_cols = db.query(func.count(ColModel.id)).scalar()
    searches_today = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == "search.perform",
        AuditLog.created_at >= today_start
    ).scalar()
    chats_today = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == "chat.query",
        AuditLog.created_at >= today_start
    ).scalar()

    # Average response time from chat messages
    from app.db.models.chat import ChatMessage
    avg_time = db.query(func.avg(ChatMessage.response_time_ms)).scalar() or 0

    # Docs by type
    type_counts = db.query(DocModel.file_type, func.count(DocModel.id)).filter_by(is_deleted=False).group_by(DocModel.file_type).all()
    docs_by_type = {str(ft): cnt for ft, cnt in type_counts}

    # Queries per day (last 7 days)
    queries_per_day = []
    for i in range(6, -1, -1):
        day = date.today() - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc)
        day_end = datetime.combine(day + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
        cnt = db.query(func.count(AuditLog.id)).filter(
            AuditLog.action.in_(["search.perform", "chat.query"]),
            AuditLog.created_at >= day_start,
            AuditLog.created_at < day_end,
        ).scalar()
        queries_per_day.append({"date": str(day), "count": cnt})

    return {
        "total_documents": total_docs,
        "total_users": total_users,
        "total_collections": total_cols,
        "total_searches_today": searches_today,
        "total_chats_today": chats_today,
        "avg_response_time_ms": round(float(avg_time), 1),
        "documents_by_type": docs_by_type,
        "queries_per_day": queries_per_day,
    }


# ─────────────────────────────────────────────────────────────────────────────
# backend/app/api/v1/endpoints/audit.py
# ─────────────────────────────────────────────────────────────────────────────
audit_router = APIRouter(prefix="/audit", tags=["Audit"])


@audit_router.get("/")
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_id: str | None = None,
    action: str | None = None,
    current_user: User = Depends(require_permission("audit:read")),
    db: Session = Depends(get_db),
):
    from app.db.models.audit import AuditLog
    q = db.query(AuditLog)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    items = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": l.id, "user_id": l.user_id, "action": l.action,
                "resource_type": l.resource_type, "resource_id": l.resource_id,
                "details": l.details, "ip_address": l.ip_address,
                "status": l.status.value, "created_at": l.created_at.isoformat(),
            }
            for l in items
        ],
        "total": total, "page": page, "page_size": page_size,
    }
