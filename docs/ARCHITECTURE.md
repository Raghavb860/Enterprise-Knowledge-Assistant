# Enterprise Knowledge Assistant — System Architecture

## Overview

The EKA is a fully local, offline-capable RAG (Retrieval-Augmented Generation) system
that allows enterprises to chat with their document libraries using local LLMs.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                            │
│   React 19 + Vite + TailwindCSS + ShadCN + React Query          │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTPS (localhost)
┌───────────────────────▼──────────────────────────────────────────┐
│                      FASTAPI BACKEND                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │   Auth   │  │Documents │  │  Search  │  │  Chat/RAG    │    │
│  │  Router  │  │  Router  │  │  Router  │  │    Router    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   SERVICE LAYER                         │    │
│  │  AuthService │ DocumentService │ RAGService │ AuditSvc  │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 REPOSITORY LAYER                        │    │
│  │  UserRepo │ DocumentRepo │ CollectionRepo │ ChatRepo    │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────┬──────────────────┬────────────────────────────┬──────────┘
       │                  │                            │
┌──────▼──────┐  ┌────────▼──────┐         ┌──────────▼──────────┐
│  MySQL 8    │  │   ChromaDB    │         │   Ollama (Local)    │
│             │  │  (Local FS)   │         │   qwen3:8b default  │
│ Users       │  │               │         │   llama3 / mistral  │
│ Documents   │  │ Embeddings    │         │                     │
│ Collections │  │ Vector Index  │         │ nomic-embed-text    │
│ Chat Logs   │  │               │         │ (embeddings model)  │
│ Audit Trail │  └───────────────┘         └─────────────────────┘
│ Permissions │
└─────────────┘

## RAG Pipeline

Document Upload
    │
    ▼
File Validation (type, size, malware heuristics)
    │
    ▼
Document Parser (PDF/DOCX/TXT/XLSX)
    │  Extracts: raw text, metadata (title, author, pages)
    ▼
Text Chunker (RecursiveCharacterTextSplitter)
    │  chunk_size=1000, overlap=200
    ▼
Metadata Enrichment (collection, tags, department)
    │
    ▼
Embedding Generation (nomic-embed-text via Ollama)
    │
    ▼
ChromaDB Storage (vector + metadata)
    │
    ▼
MySQL Storage (document record + chunk refs)
    │
────────────────────────────────
QUERY TIME
────────────────────────────────
    │
    ▼
Query Analysis & Sanitization
    │
    ▼
Hybrid Retrieval
  ├── Semantic Search (ChromaDB cosine similarity)
  └── Keyword Search (BM25 via rank_bm25)
    │
    ▼
Reciprocal Rank Fusion (combine results)
    │
    ▼
Re-ranking (cross-encoder, optional)
    │
    ▼
Context Builder (top-k chunks + metadata)
    │
    ▼
LLM Prompt Construction (system + context + query)
    │
    ▼
Ollama LLM (qwen3:8b streaming)
    │
    ▼
Response + Citations (doc name, page, chunk, score)

## Security Model

- JWT HS256 tokens, 30-min access + 7-day refresh
- Bcrypt password hashing (cost=12)
- File extension whitelist + python-magic MIME validation
- Prompt injection guard (blocklist + regex patterns)
- Rate limiting: 60 req/min global, 10/min on AI endpoints
- RBAC: every API endpoint checks role + permission
- All user actions written to audit_logs table

## RBAC Matrix

| Action              | SuperAdmin | Admin | KnowledgeMgr | Analyst | Viewer |
|---------------------|-----------|-------|--------------|---------|--------|
| Upload Document     | ✓         | ✓     | ✓            | ✗       | ✗      |
| Delete Document     | ✓         | ✓     | own only     | ✗       | ✗      |
| Manage Collections  | ✓         | ✓     | ✓            | ✗       | ✗      |
| Search              | ✓         | ✓     | ✓            | ✓       | ✓      |
| Chat                | ✓         | ✓     | ✓            | ✓       | ✓      |
| View Audit Logs     | ✓         | ✓     | ✗            | ✗       | ✗      |
| Manage Users        | ✓         | ✓     | ✗            | ✗       | ✗      |
| Manage Roles        | ✓         | ✗     | ✗            | ✗       | ✗      |
| View Dashboard      | ✓         | ✓     | ✓            | ✓       | ✗      |
```
