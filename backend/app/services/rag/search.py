# backend/app/services/rag/search.py
"""
Hybrid Search Service
- Semantic: ChromaDB vector similarity
- Keyword: BM25 over chunk content
- Hybrid: Reciprocal Rank Fusion (RRF) combination
- Metadata filtering: department, collection, tags, date range
"""
from dataclasses import dataclass
from typing import Optional
from rank_bm25 import BM25Okapi

from app.services.rag.vector_store import get_vector_store, SearchResult
from app.services.rag.embeddings import get_embedder
from app.core.config import settings


@dataclass
class SearchQuery:
    text: str
    collection_name: str         # ChromaDB collection (e.g. "eka_global")
    n_results: int = 8
    search_type: str = "hybrid"  # "semantic" | "keyword" | "hybrid"
    alpha: float = 0.7           # weight for vector vs BM25
    where_filter: Optional[dict] = None

    # Corpus for BM25 (pre-loaded chunk texts)
    bm25_corpus: Optional[list[str]] = None
    bm25_ids: Optional[list[str]] = None


def _reciprocal_rank_fusion(
    vector_results: list[SearchResult],
    bm25_results: list[SearchResult],
    alpha: float = 0.7,
    k: int = 60,
) -> list[SearchResult]:
    """
    RRF score = alpha * (1 / (k + vector_rank))
              + (1-alpha) * (1 / (k + bm25_rank))
    Returns merged, deduplicated list sorted by RRF score.
    """
    scores: dict[str, float] = {}
    result_map: dict[str, SearchResult] = {}

    for rank, r in enumerate(vector_results, start=1):
        scores[r.id] = scores.get(r.id, 0) + alpha * (1 / (k + rank))
        result_map[r.id] = r

    for rank, r in enumerate(bm25_results, start=1):
        scores[r.id] = scores.get(r.id, 0) + (1 - alpha) * (1 / (k + rank))
        if r.id not in result_map:
            result_map[r.id] = r

    sorted_ids = sorted(scores, key=lambda i: scores[i], reverse=True)
    fused = []
    for doc_id in sorted_ids:
        r = result_map[doc_id]
        r.score = round(scores[doc_id], 4)
        fused.append(r)
    return fused


def semantic_search(query: SearchQuery) -> list[SearchResult]:
    embedder = get_embedder()
    query_vec = embedder.embed_text(query.text)
    store = get_vector_store()
    return store.query(
        collection_name=query.collection_name,
        query_embedding=query_vec,
        n_results=query.n_results,
        where=query.where_filter,
    )


def keyword_search(query: SearchQuery) -> list[SearchResult]:
    if not query.bm25_corpus or not query.bm25_ids:
        return []

    tokenized = [t.lower().split() for t in query.bm25_corpus]
    bm25 = BM25Okapi(tokenized)
    scores = bm25.get_scores(query.text.lower().split())

    ranked = sorted(
        zip(query.bm25_ids, query.bm25_corpus, scores),
        key=lambda x: x[2], reverse=True
    )[: query.n_results]

    results = []
    for doc_id, content, score in ranked:
        if score > 0:
            results.append(SearchResult(
                id=doc_id,
                content=content,
                metadata={},
                score=round(float(score), 4),
            ))
    return results


def hybrid_search(query: SearchQuery) -> list[SearchResult]:
    vec_results = semantic_search(query)
    bm25_results = keyword_search(query)
    return _reciprocal_rank_fusion(vec_results, bm25_results, alpha=query.alpha)


def run_search(query: SearchQuery) -> list[SearchResult]:
    if query.search_type == "semantic":
        return semantic_search(query)
    if query.search_type == "keyword":
        return keyword_search(query)
    return hybrid_search(query)
