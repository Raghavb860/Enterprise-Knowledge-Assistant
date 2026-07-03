from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.models.document import Document, DocumentStatus
from app.services.document.indexer import index_document

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

pending_docs = db.query(Document).filter(Document.status.in_([DocumentStatus.PENDING, DocumentStatus.PROCESSING, DocumentStatus.FAILED])).all()
print(f"Found {len(pending_docs)} pending documents.")

for doc in pending_docs:
    print(f"Processing {doc.original_name}...")
    try:
        with open(doc.storage_path, "rb") as f:
            content = f.read()
        index_document(db, doc, content)
        print(f"Successfully processed {doc.original_name}")
    except Exception as e:
        print(f"Failed to process {doc.original_name}: {e}")

db.close()
