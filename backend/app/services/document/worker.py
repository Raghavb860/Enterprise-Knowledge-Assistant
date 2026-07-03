import asyncio
import logging
from pathlib import Path
import anyio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.models.document import Document, DocumentStatus
from app.services.document.indexer import index_document

logger = logging.getLogger(__name__)

# Global event that the API can trigger to wake up the worker
new_document_event = asyncio.Event()

# Worker state
_worker_task = None
_shutdown_event = asyncio.Event()

def _process_pending_sync():
    """Runs sequentially in a thread pool to avoid blocking the event loop."""
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Get one pending document
        doc = db.query(Document).filter(
            Document.status == DocumentStatus.PENDING,
            Document.is_deleted == False
        ).first()
        
        if not doc:
            return False  # Nothing to process
            
        logger.info(f"Worker picked up pending document: {doc.id}")
        
        try:
            content = Path(doc.storage_path).read_bytes()
            index_document(db, doc, content)
            logger.info(f"Successfully processed document: {doc.id}")
        except Exception as e:
            logger.error(f"Failed to process document {doc.id}: {e}", exc_info=True)
            try:
                db.rollback()
                doc_to_fail = db.query(Document).filter_by(id=doc.id).first()
                if doc_to_fail and doc_to_fail.status != DocumentStatus.FAILED:
                    doc_to_fail.status = DocumentStatus.FAILED
                    doc_to_fail.error_message = str(e)[:500]
                    db.commit()
            except Exception as rollback_e:
                logger.error(f"Failed to mark document {doc.id} as FAILED: {rollback_e}")
                
        return True # Processed a document, check again
    finally:
        db.close()

async def worker_loop():
    logger.info("Background document worker started.")
    while not _shutdown_event.is_set():
        try:
            # Process one by one until none are pending
            processed_any = await anyio.to_thread.run_sync(_process_pending_sync)
            
            if processed_any:
                continue # Instantly check for another one
                
            # If nothing was processed, wait for event or poll every 60s
            try:
                await asyncio.wait_for(new_document_event.wait(), timeout=60.0)
                new_document_event.clear()
            except asyncio.TimeoutError:
                pass # Just poll again
                
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Worker loop error: {e}", exc_info=True)
            await asyncio.sleep(5) # Backoff
            
    logger.info("Background document worker stopped.")

def start_worker():
    global _worker_task
    if _worker_task is None:
        _shutdown_event.clear()
        _worker_task = asyncio.create_task(worker_loop())

async def stop_worker():
    global _worker_task
    if _worker_task:
        _shutdown_event.set()
        new_document_event.set() # Wake it up so it can shut down
        await _worker_task
        _worker_task = None
