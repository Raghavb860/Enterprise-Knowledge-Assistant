# backend/app/middleware/rate_limit.py
"""
Custom per-endpoint rate limiting using slowapi.
Stricter limits on AI/LLM endpoints.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


def get_limiter() -> Limiter:
    return limiter


# ── Usage in endpoints ─────────────────────────────────────────────────────────
# @router.post("/chat/message")
# @limiter.limit("10/minute")          ← AI endpoint: stricter
# async def send_message(request: Request, ...):
#
# @router.post("/search/")
# @limiter.limit("30/minute")          ← Search: moderate
# async def search(request: Request, ...):
#
# @router.get("/documents/")
# @limiter.limit("60/minute")          ← CRUD: relaxed
# async def list_documents(request: Request, ...):


# backend/app/middleware/logging_middleware.py
"""
Request/Response logging middleware.
Logs method, path, status, and duration for every request.
"""
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("eka.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.monotonic()
        response = await call_next(request)
        elapsed = round((time.monotonic() - start) * 1000, 1)

        # Skip logging for static assets and health checks
        if request.url.path in ("/api/health", "/favicon.ico"):
            return response

        logger.info(
            "%s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
        response.headers["X-Response-Time-Ms"] = str(elapsed)
        return response
