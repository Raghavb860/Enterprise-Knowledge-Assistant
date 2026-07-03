# Enterprise Knowledge Assistant — Complete Setup Guide

## Prerequisites checklist
Before starting, confirm you have:
- Windows 10/11 64-bit
- 16 GB RAM minimum (32 GB recommended for qwen3:8b)
- 30 GB free disk space
- Internet connection for initial downloads

---

## STEP 1 — Install Python 3.12

1. Go to https://www.python.org/downloads/release/python-3120/
2. Download "Windows installer (64-bit)"
3. Run installer → CHECK "Add Python to PATH" → Install Now
4. Verify in a new terminal:
   ```
   python --version
   # Should print: Python 3.12.x
   pip --version
   ```

---

## STEP 2 — Install MySQL 8

1. Download MySQL Installer: https://dev.mysql.com/downloads/installer/
2. Choose "mysql-installer-community-8.x.x.msi"
3. Run installer → Developer Default setup
4. Set root password (remember it!)
5. Complete installation

6. Open MySQL Command Line Client and run:
   ```sql
   CREATE DATABASE eka_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'eka_user'@'localhost' IDENTIFIED BY 'eka_pass';
   GRANT ALL PRIVILEGES ON eka_db.* TO 'eka_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

7. Import the schema:
   ```
   mysql -u eka_user -p eka_db < database/schema/001_initial_schema.sql
   ```
   Enter password: eka_pass

---

## STEP 3 — Install Node.js 20+

1. Go to https://nodejs.org/
2. Download LTS version
3. Run installer with defaults
4. Verify:
   ```
   node --version   # Should be 20.x+
   npm --version
   ```

---

## STEP 4 — Install Ollama

1. Go to https://ollama.com/download
2. Download and run the Windows installer
3. Ollama runs as a background service automatically

4. Open PowerShell and pull the required models:
   ```powershell
   # Default LLM (8B params — needs ~8 GB RAM)
   ollama pull qwen3:8b

   # Embedding model (lightweight, needed for indexing)
   ollama pull nomic-embed-text

   # Optional alternative LLMs:
   # ollama pull llama3
   # ollama pull mistral
   # ollama pull gemma:7b
   ```

5. Test Ollama is working:
   ```powershell
   ollama list
   # Should show: qwen3:8b, nomic-embed-text
   
   ollama run qwen3:8b "Hello, are you working?"
   # Should respond with text
   ```

---

## STEP 5 — Install libmagic (for MIME validation)

On Windows, python-magic needs a DLL:
```powershell
pip install python-magic-bin
```
This installs the Windows-compatible magic binary automatically.

---

## STEP 6 — Backend Setup

```powershell
# Navigate to project root
cd C:\Projects\eka   # (wherever you cloned/saved the project)

# Go to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# If you get execution policy error:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1

# Install all dependencies
pip install -r requirements.txt

# Create your .env file from template
copy .env.example .env
```

Now edit `.env` in Notepad/VS Code:
- Change `SECRET_KEY` to a long random string (at least 32 chars)
- Verify `DATABASE_URL` matches your MySQL credentials
- Keep everything else as default for local development

---

## STEP 7 — Create Data Directories

```powershell
# Still in backend/
mkdir data\uploads
mkdir data\chroma
```

---

## STEP 8 — Run Alembic Migrations

```powershell
# Still in backend/ with venv activated
# Set the DATABASE_URL environment variable
$env:DATABASE_URL = "mysql+pymysql://eka_user:eka_pass@localhost:3306/eka_db"

# Run migrations
alembic upgrade head
```

If you prefer, you can skip Alembic and use the raw SQL schema instead:
```powershell
# Alternative: direct SQL import
mysql -u eka_user -p eka_db < ..\database\schema\001_initial_schema.sql
```

---

## STEP 9 — Start the FastAPI Backend

```powershell
# In backend/ with venv activated
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     🚀 Enterprise Knowledge Assistant started on development
INFO:     📄 Swagger UI: http://localhost:8000/api/docs
```

Verify the API is running:
- Open http://localhost:8000/api/health → should return `{"status":"ok"}`
- Open http://localhost:8000/api/docs → interactive Swagger UI

---

## STEP 10 — Frontend Setup

Open a NEW PowerShell window:

```powershell
# Navigate to frontend/
cd C:\Projects\eka\frontend

# Install all npm packages
npm install

# Start development server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

---

## STEP 11 — Verify the Full Application

1. Open http://localhost:5173 in your browser
2. You should see the login page with the brain icon
3. Sign in with:
   - Email: `admin@eka.local`
   - Password: `Admin@123`
4. You should be redirected to the Dashboard

---

## STEP 12 — First Use Walkthrough

### Upload your first document:
1. Click "Upload" in the sidebar
2. Drag and drop a PDF file
3. Click "Upload 1 file"
4. Watch status change: pending → processing → ready
   (this takes 30-120 seconds depending on document size and your hardware)

### Search your documents:
1. Click "Search" in the sidebar
2. Type a question about your document
3. See results with scores and excerpts

### Chat with your documents:
1. Click "Chat" in the sidebar
2. Click "New chat"
3. Ask: "What is this document about?"
4. See the AI answer with citations showing document name, page, and chunk

---

## Running Backend Tests

```powershell
# In backend/ with venv activated
pytest tests/ -v

# Run specific test file
pytest tests/conftest.py -v -k "TestAuthService"

# With coverage
pip install pytest-cov
pytest tests/ --cov=app --cov-report=html
```

---

## Running Frontend Tests

```powershell
# In frontend/
npm run test

# Interactive UI
npm run test:ui
```

---

## Switching LLM Models

Edit `backend/.env`:
```
OLLAMA_LLM_MODEL=llama3
# or
OLLAMA_LLM_MODEL=mistral
# or
OLLAMA_LLM_MODEL=gemma:7b
```

Then restart the backend. Users can also choose the model per chat session.

---

## Switching Vector Database (Adapter Pattern)

To use Qdrant instead of ChromaDB:

1. Install: `pip install qdrant-client`

2. Create `backend/app/services/rag/qdrant_adapter.py`:
   ```python
   from qdrant_client import QdrantClient
   from app.services.rag.vector_store import VectorStoreAdapter, VectorDocument, SearchResult

   class QdrantVectorStore(VectorStoreAdapter):
       def __init__(self):
           self._client = QdrantClient(host="localhost", port=6333)
       # implement all abstract methods...
   ```

3. In `vector_store.py`, change `get_vector_store()`:
   ```python
   from app.services.rag.qdrant_adapter import QdrantVectorStore
   def get_vector_store():
       return QdrantVectorStore()
   ```

The rest of the codebase requires zero changes.

---

## Common Issues & Fixes

### "Ollama connection refused"
- Make sure Ollama is running: check system tray or run `ollama serve`
- Verify: `curl http://localhost:11434/api/tags`

### "Model not found"
- Pull it: `ollama pull qwen3:8b`

### MySQL connection error
- Check credentials in `.env`
- Make sure MySQL service is running (Services → MySQL80 → Start)

### "magic" import error on Windows
- Run: `pip install python-magic-bin`

### ChromaDB data persists between runs
- Data stored in `backend/data/chroma/` — delete to reset

### CORS errors in browser
- Make sure `ALLOWED_ORIGINS` in `.env` includes `http://localhost:5173`

### Out of memory during embedding
- Reduce batch size in `embedder.embed_batch()` 
- Or use a smaller model: `ollama pull nomic-embed-text` (default, already small)

---

## Project Folder Structure Reference

```
eka/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    ← Route handlers
│   │   ├── core/                ← Config, dependencies
│   │   ├── db/
│   │   │   ├── models/          ← SQLAlchemy ORM models
│   │   │   └── session.py       ← DB engine + session
│   │   ├── services/
│   │   │   ├── auth_service.py  ← JWT, bcrypt
│   │   │   ├── audit_service.py ← Audit logging
│   │   │   ├── document/        ← parser, chunker, validator, indexer
│   │   │   └── rag/             ← embeddings, search, pipeline (LangGraph)
│   │   └── main.py              ← FastAPI app factory
│   ├── migrations/              ← Alembic versions
│   ├── tests/                   ← pytest tests
│   ├── data/
│   │   ├── uploads/             ← Uploaded files (gitignored)
│   │   └── chroma/              ← ChromaDB persistence (gitignored)
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/          ← AppLayout (sidebar + outlet)
│   │   ├── pages/               ← All page components
│   │   ├── hooks/               ← React Query hooks
│   │   ├── services/            ← Axios API client
│   │   ├── store/               ← Auth context + reducer
│   │   ├── types/               ← TypeScript interfaces
│   │   ├── utils/               ← cn(), formatBytes()
│   │   ├── test/                ← Vitest tests
│   │   ├── App.tsx              ← Router + providers
│   │   ├── main.tsx             ← React entry point
│   │   └── index.css            ← Tailwind + CSS variables
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── database/
│   └── schema/
│       └── 001_initial_schema.sql  ← Complete MySQL schema + seeds
│
└── docs/
    └── ARCHITECTURE.md
```

---

## Future Enhancements

1. **Streaming responses** — Use `StreamingResponse` in FastAPI + `EventSource` in React for real-time token streaming from Ollama

2. **Background job queue** — Replace threading with Celery + Redis for robust async processing

3. **Multi-file chat** — Allow users to pin specific documents to a conversation scope

4. **Re-ranking** — Add a cross-encoder (e.g. `cross-encoder/ms-marco-MiniLM-L-6-v2` via sentence-transformers) for better chunk ordering

5. **Document versioning** — Track document updates and re-index only changed chunks

6. **Export conversations** — Download chat history as PDF or Markdown with full citations

7. **SSO / LDAP** — Enterprise authentication via python-ldap or SAML

8. **Email notifications** — Notify users when document processing completes

9. **Qdrant / Weaviate migration** — The adapter pattern makes this a 30-minute task

10. **GPU acceleration** — If you have an NVIDIA GPU, Ollama automatically uses it; no code changes needed

11. **Analytics** — Extend the dashboard with per-user query patterns, topic clustering, and document usage heat maps

12. **Multi-language** — Switch embedding model to `multilingual-e5-large` for non-English document support
```
