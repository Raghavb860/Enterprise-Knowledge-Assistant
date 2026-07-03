# backend/app/services/audit_service.py
"""
Audit Service
Records every significant user action to the audit_logs table.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.db.models.audit import AuditLog, AuditStatus


def log_action(
    db: Session,
    action: str,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    status: AuditStatus = AuditStatus.SUCCESS,
    request: Optional[Request] = None,
) -> AuditLog:
    ip = None
    ua = None
    if request:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")

    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip,
        user_agent=ua,
        status=status,
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    return log


# ─── Convenience functions ────────────────────────────────────────────────────

def audit_login(db: Session, user_id: str, request: Request) -> None:
    log_action(db, "user.login", user_id=user_id, request=request)


def audit_logout(db: Session, user_id: str, request: Request) -> None:
    log_action(db, "user.logout", user_id=user_id, request=request)


def audit_upload(db: Session, user_id: str, document_id: str, filename: str, request: Request) -> None:
    log_action(
        db, "document.upload",
        user_id=user_id,
        resource_type="document",
        resource_id=document_id,
        details={"filename": filename},
        request=request,
    )


def audit_delete(db: Session, user_id: str, document_id: str, filename: str, request: Request) -> None:
    log_action(
        db, "document.delete",
        user_id=user_id,
        resource_type="document",
        resource_id=document_id,
        details={"filename": filename},
        request=request,
    )


def audit_search(db: Session, user_id: str, query: str, result_count: int, request: Request) -> None:
    log_action(
        db, "search.perform",
        user_id=user_id,
        resource_type="search",
        details={"query": query[:200], "result_count": result_count},
        request=request,
    )


def audit_chat(db: Session, user_id: str, session_id: str, query: str, request: Request) -> None:
    log_action(
        db, "chat.query",
        user_id=user_id,
        resource_type="chat_session",
        resource_id=session_id,
        details={"query": query[:200]},
        request=request,
    )
