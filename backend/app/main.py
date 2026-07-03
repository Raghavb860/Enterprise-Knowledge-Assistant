# backend/app/main.py
"""
Enterprise Knowledge Assistant - FastAPI Application
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.services.document.worker import start_worker, stop_worker
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.documents import router as doc_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.all_endpoints import (
    router as search_router,
    collections_router,
    users_router,
    dashboard_router,
    audit_router,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
if settings.DEBUG:
    logging.getLogger("app").setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)

# Silence noisy libraries
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("chromadb").setLevel(logging.WARNING)
logging.getLogger("chromadb.telemetry").setLevel(logging.CRITICAL)
logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)
# ─── Rate Limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ─── Application ──────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Startup
        import os
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        logger.info(f"🚀 {settings.APP_NAME} started on {settings.ENVIRONMENT}")
        logger.info(f"📄 Swagger UI: http://localhost:8000/api/docs")
        
        # Start background workers
        start_worker()
        
        yield
        
        # Shutdown
        await stop_worker()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global error handler ────────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        if isinstance(exc, StarletteHTTPException):
            raise exc
        logger.error(f"Unhandled error: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(exc) or "Internal server error"})

    # ── Health check ────────────────────────────────────────────────────────
    @app.get("/api/health", tags=["Health"])
    def health():
        return {"status": "ok", "version": settings.APP_VERSION}

    # ── Routers ─────────────────────────────────────────────────────────────
    PREFIX = "/api/v1"
    app.include_router(auth_router,        prefix=PREFIX)
    app.include_router(doc_router,         prefix=PREFIX)
    app.include_router(chat_router,        prefix=PREFIX)
    app.include_router(search_router,      prefix=PREFIX)
    app.include_router(collections_router, prefix=PREFIX)
    app.include_router(users_router,       prefix=PREFIX)
    app.include_router(dashboard_router,   prefix=PREFIX)
    app.include_router(audit_router,       prefix=PREFIX)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
