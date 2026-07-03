# backend/app/services/document/indexer.py
"""
Document Indexer
Orchestrates the full ingestion pipeline:
  parse → chunk → embed → store in ChromaDB → update MySQL
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models.document import Document, DocumentChunk, DocumentStatus
from app.db.models.job import ProcessingJob, JobStatus, JobType
from app.services.document.parser import parse_document
from app.services.document.chunker import chunk_parsed_document, TextChunk
from app.services.rag.embeddings import get_embedder
from app.services.rag.vector_store import get_vector_store, VectorDocument
from app.core.config import settings


GLOBAL_COLLECTION = f"{settings.CHROMA_COLLECTION_PREFIX}_global"


def _make_chroma_collection(document_id: str) -> str:
    """Each document also gets its own collection for targeted queries."""
    prefix = settings.CHROMA_COLLECTION_PREFIX
    short = document_id.replace("-", "")[:16]
    return f"{prefix}_{short}"


def index_document(db: Session, document: Document, file_content: bytes) -> None:
    """
    Full pipeline: parse → chunk → embed → ChromaDB → MySQL.
    Updates document.status throughout.
    """
    job = ProcessingJob(
        document_id=document.id,
        job_type=JobType.PARSE,
        status=JobStatus.RUNNING,
        started_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()

    try:
        # 1. Parse
        document.status = DocumentStatus.PROCESSING
        db.commit()

        parsed = parse_document(file_content, document.file_type.value)
        document.page_count = parsed.page_count
        document.word_count = parsed.word_count
        if parsed.title and not document.title:
            document.title = parsed.title
        if parsed.author and not document.author:
            document.author = parsed.author
        db.commit()

        job.progress = 20
        db.commit()

        # 2. Chunk
        chunks: list[TextChunk] = chunk_parsed_document(parsed)
        if not chunks:
            raise ValueError("Document produced zero chunks after parsing.")

        job.progress = 40
        db.commit()

        # 3. Embed
        embedder = get_embedder()
        texts = [c.content for c in chunks]
        embeddings = embedder.embed_batch(texts)

        job.progress = 70
        db.commit()

        # 4. Store in ChromaDB (global + per-doc collections)
        store = get_vector_store()
        doc_collection = _make_chroma_collection(document.id)

        vector_docs = []
        for chunk, embedding in zip(chunks, embeddings):
            chunk_id = f"{document.id}_{chunk.chunk_index}"
            meta = {
                "document_id":   document.id,
                "original_name": document.original_name,
                "file_type":     document.file_type.value,
                "page_number":   chunk.page_number,
                "chunk_index":   chunk.chunk_index,
                "collection_id": document.collection_id or "",
                "department":    document.department or "",
                "owner_id":      document.owner_id,
                "tags":          ",".join(document.tags or []),
            }
            vector_docs.append(VectorDocument(
                id=chunk_id,
                content=chunk.content,
                metadata=meta,
                embedding=embedding,
            ))

        store.upsert(GLOBAL_COLLECTION, vector_docs)
        store.upsert(doc_collection, vector_docs)

        job.progress = 85
        db.commit()

        # 5. Store chunks in MySQL
        now = datetime.now(timezone.utc)
        db_chunks = []
        for chunk, vec_doc in zip(chunks, vector_docs):
            db_chunks.append(DocumentChunk(
                document_id=document.id,
                chunk_index=chunk.chunk_index,
                page_number=chunk.page_number,
                content=chunk.content,
                char_count=chunk.char_count,
                token_estimate=chunk.token_estimate,
                chroma_chunk_id=vec_doc.id,
                created_at=now,
            ))
        db.add_all(db_chunks)

        document.chunk_count = len(chunks)
        document.chroma_collection = doc_collection
        document.status = DocumentStatus.READY

        job.status = JobStatus.DONE
        job.progress = 100
        job.finished_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as exc:
        document.status = DocumentStatus.FAILED
        document.error_message = str(exc)[:500]
        job.status = JobStatus.FAILED
        job.error_message = str(exc)[:500]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise


def remove_document_from_index(db: Session, document: Document) -> None:
    """Delete all vectors for a document from ChromaDB."""
    store = get_vector_store()
    # Delete from per-doc collection
    if document.chroma_collection:
        store.delete_collection(document.chroma_collection)

    # Delete from global collection
    chunk_ids = [f"{document.id}_{c.chunk_index}" for c in document.chunks]
    if chunk_ids:
        store.delete(GLOBAL_COLLECTION, chunk_ids)
