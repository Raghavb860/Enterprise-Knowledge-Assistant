# backend/app/api/v1/endpoints/chat.py
"""Chat endpoints - multi-turn RAG conversations with citations."""
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
import json
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.user import User
from app.db.models.chat import ChatSession, ChatMessage, MessageRole
from app.services.rag.pipeline import run_rag, run_rag_stream
from app.services.audit_service import audit_chat
from app.core.dependencies import get_current_user, require_permission
from app.core.config import settings
from fastapi import Request

router = APIRouter(prefix="/chat", tags=["Chat"])

# Import the global collection constant from indexer
try:
    from app.services.document.indexer import GLOBAL_COLLECTION
except ImportError:
    GLOBAL_COLLECTION = f"{settings.CHROMA_COLLECTION_PREFIX}_global"


@router.post("/sessions", status_code=201)
def create_session(
    payload: dict,
    current_user: User = Depends(require_permission("chat:create")),
    db: Session = Depends(get_db),
):
    session = ChatSession(
        user_id=current_user.id,
        title=payload.get("title", "New Conversation"),
        model_used=payload.get("model", settings.OLLAMA_LLM_MODEL),
        collection_id=payload.get("collection_id"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_dict(session)


@router.get("/sessions")
def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_permission("chat:history")),
    db: Session = Depends(get_db),
):
    q = db.query(ChatSession).filter_by(user_id=current_user.id, is_archived=False)
    total = q.count()
    items = q.order_by(ChatSession.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_session_to_dict(s) for s in items], "total": total, "page": page, "page_size": page_size}


@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    current_user: User = Depends(require_permission("chat:history")),
    db: Session = Depends(get_db),
):
    session = _get_session_or_404(db, session_id, current_user.id)
    return {
        **_session_to_dict(session),
        "messages": [_msg_to_dict(m) for m in session.messages],
    }


@router.post("/message")
def send_message(
    payload: dict,
    request: Request,
    current_user: User = Depends(require_permission("chat:create")),
    db: Session = Depends(get_db),
):
    session_id = payload.get("session_id")
    user_message = payload.get("message", "").strip()
    model = payload.get("model", settings.OLLAMA_LLM_MODEL)

    if not user_message:
        raise HTTPException(400, "Message cannot be empty")

    session = _get_session_or_404(db, session_id, current_user.id)

    # Persist user message
    now = datetime.now(timezone.utc)
    user_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.USER,
        content=user_message,
        created_at=now,
    )
    db.add(user_msg)
    
    # Auto-generate title on first message
    if session.title == "New Conversation" or session.message_count == 0:
        session.title = user_message[:40] + ("..." if len(user_message) > 40 else "")
        
    session.message_count += 1
    db.commit()

    # Build chat history for context
    history = [
        {"role": m.role.value, "content": m.content}
        for m in session.messages[-10:]  # last 5 turns
        if m.role.value in ("user", "assistant")
    ]

    # Determine which ChromaDB collection to search
    if session.collection_id:
        # search only docs in this collection
        where_filter = {"collection_id": session.collection_id}
        collection_name = GLOBAL_COLLECTION
    else:
        where_filter = None
        collection_name = GLOBAL_COLLECTION

    # Run RAG pipeline
    t0 = time.monotonic()
    result = run_rag(
        query=user_message,
        collection_name=collection_name,
        chat_history=history[:-1],  # exclude current turn
        model=model,
        where_filter=where_filter,
    )
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    error = result.error

    if error:
        raise HTTPException(400, error)

    answer = result.answer
    citations = result.citations
    assistant_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.ASSISTANT,
        content=answer,
        citations=citations,
        model_used=model,
        response_time_ms=elapsed_ms,
        created_at=datetime.now(timezone.utc),
    )
    db.add(assistant_msg)

    # Update session stats
    session.message_count += 1
    session.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(assistant_msg)

    audit_chat(db, current_user.id, session.id, user_message, request)

    return {
    "message_id": assistant_msg.id,
    "answer": answer,
    "citations": citations,
    "model_used": model,
    "response_time_ms": elapsed_ms,
}


@router.post("/message/stream")
def send_message_stream(
    payload: dict,
    request: Request,
    current_user: User = Depends(require_permission("chat:create")),
    db: Session = Depends(get_db),
):
    session_id = payload.get("session_id")
    user_message = payload.get("message", "").strip()
    model = payload.get("model", settings.OLLAMA_LLM_MODEL)

    if not user_message:
        raise HTTPException(400, "Message cannot be empty")

    session = _get_session_or_404(db, session_id, current_user.id)

    now = datetime.now(timezone.utc)
    user_msg = ChatMessage(
        session_id=session.id,
        role=MessageRole.USER,
        content=user_message,
        created_at=now,
    )
    db.add(user_msg)
    
    if session.title == "New Conversation" or session.message_count == 0:
        session.title = user_message[:40] + ("..." if len(user_message) > 40 else "")
        
    session.message_count += 1
    db.commit()

    history = [
        {"role": m.role.value, "content": m.content}
        for m in session.messages[-10:]
        if m.role.value in ("user", "assistant")
    ]

    if session.collection_id:
        where_filter = {"collection_id": session.collection_id}
        collection_name = GLOBAL_COLLECTION
    else:
        where_filter = None
        collection_name = GLOBAL_COLLECTION

    def stream_generator():
        t0 = time.monotonic()
        citations = []
        answer_parts = []
        
        try:
            for event in run_rag_stream(
                query=user_message,
                collection_name=collection_name,
                chat_history=history[:-1],
                model=model,
                where_filter=where_filter,
            ):
                if event["type"] == "metadata":
                    citations = event.get("citations", [])
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "token":
                    answer_parts.append(event["content"])
                    yield f"data: {json.dumps(event)}\n\n"
                elif event["type"] == "error":
                    yield f"data: {json.dumps(event)}\n\n"
                    return

            elapsed_ms = int((time.monotonic() - t0) * 1000)
            answer = "".join(answer_parts)
            
            assistant_msg = ChatMessage(
                session_id=session.id,
                role=MessageRole.ASSISTANT,
                content=answer,
                citations=citations,
                model_used=model,
                response_time_ms=elapsed_ms,
                created_at=datetime.now(timezone.utc),
            )
            db.add(assistant_msg)
            session.message_count += 1
            session.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(assistant_msg)
            
            audit_chat(db, current_user.id, session.id, user_message, request)
            
            yield f"data: {json.dumps({'type': 'done', 'message_id': assistant_msg.id, 'response_time_ms': elapsed_ms})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream")



@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_session_or_404(db, session_id, current_user.id)
    db.delete(session)
    db.commit()
    return {"message": "Conversation deleted"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_session_or_404(db: Session, session_id: str, user_id: str) -> ChatSession:
    s = db.query(ChatSession).filter_by(id=session_id, user_id=user_id).first()
    if not s:
        raise HTTPException(404, "Chat session not found")
    return s


def _session_to_dict(s: ChatSession) -> dict:
    return {
        "id": s.id, "title": s.title, "model_used": s.model_used,
        "collection_id": s.collection_id, "message_count": s.message_count,
        "is_archived": s.is_archived,
        "created_at": s.created_at.isoformat(), "updated_at": s.updated_at.isoformat(),
    }


def _msg_to_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id, "session_id": m.session_id,
        "role": m.role.value, "content": m.content,
        "citations": m.citations, "model_used": m.model_used,
        "response_time_ms": m.response_time_ms,
        "created_at": m.created_at.isoformat(),
    }
