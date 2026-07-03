# Enterprise Knowledge Assistant — LangGraph & LangChain Integration Guide

## Overview

The RAG pipeline is implemented as a **LangGraph StateGraph** — a directed acyclic
graph where each node transforms the shared `RAGState` object.

```
sanitize_query
      │
      ▼
  retrieve_chunks          ← Hybrid search (ChromaDB + BM25)
      │
      ▼
 build_context             ← Concatenate chunks with metadata headers
      │
      ▼
  generate_answer          ← OllamaLLM streaming (qwen3:8b)
      │
      ▼
format_citations           ← Extract doc name / page / chunk / score
      │
      ▼
      END
```

---

## Node Details

### 1. sanitize_query
- Strips prompt injection patterns (regex)
- Truncates to 2000 chars
- Raises `ValueError` → HTTP 400 for injections

### 2. retrieve_chunks
Calls `hybrid_search()` which:
- **Semantic path**: embeds query with `nomic-embed-text`, queries ChromaDB
- **Keyword path**: tokenises query + corpus, runs `BM25Okapi.get_scores()`
- **Fusion**: Reciprocal Rank Fusion with configurable `alpha` (0.7 default)

### 3. build_context
Formats each chunk as:
```
[Doc: filename.pdf, Page 12, Chunk 45, Score 0.92]
<chunk text here>
```
Joins with `---` separator. Max 8 chunks (configurable via `MAX_CHUNKS_PER_QUERY`).

### 4. generate_answer
Uses `langchain_ollama.OllamaLLM` with:
- `temperature=0.1` (low = factual, deterministic)
- `num_predict=4096`
- Chat history: last 3 turns (6 messages) prepended
- System prompt enforces document-only answers + citation format

### 5. format_citations
Reads `retrieved_chunks` metadata → builds JSON citations list
returned to the client.

---

## Customising the LangGraph Pipeline

### Add a re-ranking node

```python
# backend/app/services/rag/reranker.py
from sentence_transformers import CrossEncoder

_model = None

def get_reranker():
    global _model
    if _model is None:
        _model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _model


def node_rerank(state: RAGState) -> RAGState:
    if not state.retrieved_chunks or state.error:
        return state
    reranker = get_reranker()
    pairs = [(state.sanitized_query, chunk.content) for chunk in state.retrieved_chunks]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(state.retrieved_chunks, scores), key=lambda x: x[1], reverse=True)
    state.retrieved_chunks = [chunk for chunk, _ in ranked]
    return state
```

Then add it to the graph in `pipeline.py`:
```python
graph.add_node("rerank", node_rerank)
graph.add_edge("retrieve",     "rerank")
graph.add_edge("rerank",       "build_context")
# Remove: graph.add_edge("retrieve", "build_context")
```

Install: `pip install sentence-transformers`

---

### Streaming responses

For real-time token streaming, replace `node_generate` with:

```python
# In your FastAPI endpoint:
from fastapi.responses import StreamingResponse

@router.post("/chat/stream")
async def stream_message(payload: dict, ...):
    llm = OllamaLLM(model=settings.OLLAMA_LLM_MODEL, streaming=True)
    
    async def generate():
        async for chunk in llm.astream(prompt):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

Frontend SSE handler:
```typescript
const es = new EventSource('/api/v1/chat/stream')
es.onmessage = (e) => {
  if (e.data === '[DONE]') return es.close()
  const { token } = JSON.parse(e.data)
  setAnswer(prev => prev + token)
}
```

---

## Embedding Model Options

| Model              | Dims | Size   | Quality  | Use case           |
|--------------------|------|--------|----------|--------------------|
| nomic-embed-text   | 768  | 274 MB | ⭐⭐⭐⭐   | Default, excellent |
| all-minilm-l6-v2  | 384  | 91 MB  | ⭐⭐⭐    | Faster, lighter    |
| multilingual-e5-large | 1024 | 560 MB | ⭐⭐⭐⭐⭐ | Multi-language     |
| mxbai-embed-large  | 1024 | 670 MB | ⭐⭐⭐⭐⭐ | Best English       |

Change in `.env`:
```
OLLAMA_EMBED_MODEL=mxbai-embed-large
```

**Important:** After changing the embed model, you must re-index all documents,
since embeddings from different models are not compatible. Run:
```powershell
# 1. Wipe ChromaDB
.\scripts\reset_chroma.ps1

# 2. Re-trigger indexing for all ready documents
# (or upload them again — the hash check will skip re-upload but re-index)
```

---

## LLM Model Comparison (Local)

| Model       | RAM   | Speed  | Quality  | Context |
|-------------|-------|--------|----------|---------|
| qwen3:8b    | 8 GB  | Medium | ⭐⭐⭐⭐⭐  | 32k     |
| llama3:8b   | 8 GB  | Medium | ⭐⭐⭐⭐   | 8k      |
| mistral:7b  | 6 GB  | Fast   | ⭐⭐⭐⭐   | 8k      |
| gemma:7b    | 6 GB  | Fast   | ⭐⭐⭐    | 8k      |
| phi3:mini   | 3 GB  | Fastest| ⭐⭐⭐    | 4k      |
| llama3:70b  | 48 GB | Slow   | ⭐⭐⭐⭐⭐  | 8k      |

**Recommendation for portfolio demo:**
- 16 GB RAM laptop → `qwen3:8b` or `mistral:7b`
- 8 GB RAM laptop  → `phi3:mini` or `gemma:7b`
- 32 GB RAM laptop → `llama3:70b` for best results

---

## ChromaDB → Qdrant Migration (Step by Step)

### 1. Run Qdrant locally
```powershell
# Install Qdrant (no Docker needed — standalone binary)
# Download from: https://github.com/qdrant/qdrant/releases
# Run: .\qdrant.exe
# Default: http://localhost:6333
```

### 2. Install client
```powershell
pip install qdrant-client
```

### 3. Create Qdrant adapter
```python
# backend/app/services/rag/qdrant_adapter.py
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
)
from app.services.rag.vector_store import VectorStoreAdapter, VectorDocument, SearchResult


class QdrantVectorStore(VectorStoreAdapter):
    def __init__(self, host="localhost", port=6333):
        self._client = QdrantClient(host=host, port=port)
        self._dim = 768  # nomic-embed-text dimension

    def _ensure_collection(self, name: str):
        existing = [c.name for c in self._client.get_collections().collections]
        if name not in existing:
            self._client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(size=self._dim, distance=Distance.COSINE),
            )

    def upsert(self, collection_name: str, docs: list[VectorDocument]):
        self._ensure_collection(collection_name)
        points = [
            PointStruct(
                id=abs(hash(d.id)) % (2**63),   # Qdrant needs int IDs
                vector=d.embedding,
                payload={**d.metadata, "_text": d.content, "_orig_id": d.id},
            )
            for d in docs
        ]
        self._client.upsert(collection_name=collection_name, points=points)

    def query(self, collection_name, query_embedding, n_results=10, where=None):
        self._ensure_collection(collection_name)
        results = self._client.search(
            collection_name=collection_name,
            query_vector=query_embedding,
            limit=n_results,
        )
        return [
            SearchResult(
                id=str(r.payload["_orig_id"]),
                content=r.payload["_text"],
                metadata={k: v for k, v in r.payload.items() if not k.startswith("_")},
                score=round(r.score, 4),
                document_name=r.payload.get("original_name", ""),
                page_number=r.payload.get("page_number", 0),
                chunk_index=r.payload.get("chunk_index", 0),
            )
            for r in results
        ]

    def delete(self, collection_name, ids):
        # Qdrant delete by filter on _orig_id
        from qdrant_client.models import Filter, FieldCondition, MatchAny
        self._client.delete(
            collection_name=collection_name,
            points_selector=Filter(must=[
                FieldCondition(key="_orig_id", match=MatchAny(any=ids))
            ])
        )

    def delete_collection(self, collection_name):
        try:
            self._client.delete_collection(collection_name)
        except Exception:
            pass

    def collection_exists(self, collection_name):
        return collection_name in [c.name for c in self._client.get_collections().collections]

    def count(self, collection_name):
        try:
            info = self._client.get_collection(collection_name)
            return info.points_count
        except Exception:
            return 0
```

### 4. Swap in get_vector_store()
```python
# backend/app/services/rag/vector_store.py
# Change the factory:
def get_vector_store() -> VectorStoreAdapter:
    global _vector_store
    if _vector_store is None:
        from app.services.rag.qdrant_adapter import QdrantVectorStore
        _vector_store = QdrantVectorStore()
    return _vector_store
```

### 5. Re-index all documents
```powershell
.\scripts\reset_chroma.ps1   # Only needed if Chroma data folder is shared
# Re-upload or trigger re-indexing via admin panel
```

**No other code changes required.** All services, endpoints, and the RAG pipeline
interact with `get_vector_store()` through the abstract interface.
