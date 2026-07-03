# backend/app/services/rag/vector_store.py
"""
Vector Store Abstraction
- Adapter pattern so ChromaDB can be swapped for Qdrant, Weaviate, or Milvus
- All callers use VectorStore interface only
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import os

os.environ["ANONYMIZED_TELEMETRY"] = "False"
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings


# ─── Domain Types ─────────────────────────────────────────────────────────────

@dataclass
class VectorDocument:
    id: str
    content: str
    metadata: dict
    embedding: Optional[list[float]] = None


@dataclass
class SearchResult:
    id: str
    content: str
    metadata: dict
    score: float
    document_name: str = ""
    page_number: int = 0
    chunk_index: int = 0


# ─── Abstract Interface ────────────────────────────────────────────────────────

class VectorStoreAdapter(ABC):

    @abstractmethod
    def upsert(self, collection_name: str, docs: list[VectorDocument]) -> None:
        ...

    @abstractmethod
    def query(
        self,
        collection_name: str,
        query_embedding: list[float],
        n_results: int = 10,
        where: Optional[dict] = None,
    ) -> list[SearchResult]:
        ...

    @abstractmethod
    def delete(self, collection_name: str, ids: list[str]) -> None:
        ...

    @abstractmethod
    def delete_collection(self, collection_name: str) -> None:
        ...

    @abstractmethod
    def collection_exists(self, collection_name: str) -> bool:
        ...

    @abstractmethod
    def count(self, collection_name: str) -> int:
        ...


# ─── ChromaDB Adapter ─────────────────────────────────────────────────────────

class ChromaVectorStore(VectorStoreAdapter):
    """
    ChromaDB implementation.
    Stores embeddings on local filesystem.
    Swap to QdrantVectorStore or WeaviateVectorStore by changing get_vector_store().
    """

    def __init__(self):
        self._client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def _get_collection(self, name: str):
        return self._client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert(self, collection_name: str, docs: list[VectorDocument]) -> None:
        col = self._get_collection(collection_name)
        col.upsert(
            ids=[d.id for d in docs],
            documents=[d.content for d in docs],
            metadatas=[d.metadata for d in docs],
            embeddings=[d.embedding for d in docs] if docs[0].embedding else None,
        )

    def query(
        self,
        collection_name: str,
        query_embedding: list[float],
        n_results: int = 10,
        where: Optional[dict] = None,
    ) -> list[SearchResult]:
        col = self._get_collection(collection_name)
        kwargs: dict = {
            "query_embeddings": [query_embedding],
            "n_results": min(n_results, col.count() or 1),
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where
        results = col.query(**kwargs)

        search_results = []
        for i, (doc_id, doc, meta, dist) in enumerate(zip(
            results["ids"][0],
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )):
            # Chroma returns cosine distance (0=identical, 2=opposite)
            # Convert to similarity score 0-1
            score = 1 - (dist / 2)
            search_results.append(SearchResult(
                id=doc_id,
                content=doc,
                metadata=meta,
                score=round(score, 4),
                document_name=meta.get("original_name", ""),
                page_number=meta.get("page_number", 0),
                chunk_index=meta.get("chunk_index", 0),
            ))
        return search_results

    def delete(self, collection_name: str, ids: list[str]) -> None:
        col = self._get_collection(collection_name)
        col.delete(ids=ids)

    def delete_collection(self, collection_name: str) -> None:
        try:
            self._client.delete_collection(collection_name)
        except Exception:
            pass

    def collection_exists(self, collection_name: str) -> bool:
        try:
            self._client.get_collection(collection_name)
            return True
        except Exception:
            return False

    def count(self, collection_name: str) -> int:
        try:
            col = self._client.get_collection(collection_name)
            return col.count()
        except Exception:
            return 0


# ─── Factory (swap here to change vector DB) ──────────────────────────────────

_vector_store: VectorStoreAdapter | None = None


def get_vector_store() -> VectorStoreAdapter:
    global _vector_store
    if _vector_store is None:
        _vector_store = ChromaVectorStore()
        # To switch: _vector_store = QdrantVectorStore()
    return _vector_store
