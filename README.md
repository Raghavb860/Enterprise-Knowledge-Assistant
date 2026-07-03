# Enterprise Knowledge Assistant (EKA)

**Enterprise Knowledge Assistant (EKA)** is an offline-first, highly secure Retrieval-Augmented Generation (RAG) platform designed for organizational knowledge management. It enables enterprises to securely process, index, and query multi-format internal documents (PDF, DOCX, TXT) using advanced local LLMs—all without any cloud dependencies or data privacy risks.

## 🚀 Key Features

*   **Offline-First & Secure:** Operates entirely locally. Uses locally hosted LLMs (via Ollama) and a local ChromaDB instance to ensure that sensitive enterprise data never leaves your internal network.
*   **Advanced Hybrid Retrieval Engine:** Combines **ChromaDB** semantic vector search with **BM25** exact keyword matching using Reciprocal Rank Fusion (RRF). This drastically reduces AI hallucinations by forcing the LLM to provide source-grounded answers with exact document citations.
*   **Robust Background Processing:** Features an event-driven, database-backed background worker built into FastAPI that robustly handles document parsing, chunking, and embedding. It automatically recovers stalled documents upon server restarts.
*   **Real-time Streaming Chat:** Delivers instant, token-by-token responses from local LLMs to the frontend via Server-Sent Events (SSE), eliminating long wait times and providing a smooth user experience.
*   **Enterprise-Grade Security (RBAC):** Built with strict Role-Based Access Control (RBAC) to manage permissions across users, admins, and knowledge managers.
*   **Comprehensive Audit Logging & Analytics:** Tracks all user actions (uploads, chats, deletions) and provides a real-time analytics dashboard monitoring queries, response times, and system usage.

## 🛠️ Tech Stack

### Backend
*   **Framework:** FastAPI, Python
*   **RAG Pipeline:** LangChain, LangGraph
*   **Vector Database:** ChromaDB (Local)
*   **Local LLM Integration:** Ollama (defaulting to `phi:latest`)
*   **Relational Database:** MySQL 8 with SQLAlchemy & Alembic
*   **Search Algorithms:** BM25Okapi (`rank_bm25`), Reciprocal Rank Fusion

### Frontend
*   **Framework:** React 19, TypeScript, Vite
*   **Styling:** TailwindCSS
*   **State Management:** React Query

## ⚡ Quick Start

### 1. Prerequisites
*   Node.js (v18+)
*   Python 3.10+
*   MySQL 8
*   [Ollama](https://ollama.com/) installed and running locally with the `phi` and `nomic-embed-text` models pulled:
    ```bash
    ollama pull phi:latest
    ollama pull nomic-embed-text
    ```

### 2. Start the Backend
```powershell
cd backend
python -m venv venv 
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy the example environment variables and configure your MySQL connection
copy .env.example .env   

# Run the FastAPI server
python -m uvicorn app.main:app --reload
```

### 3. Start the Frontend (New Terminal)
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. 
*(Note: Refer to `docs/SETUP_GUIDE.md` for full installation and default login credentials).*
