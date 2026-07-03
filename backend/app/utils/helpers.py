# backend/app/utils/helpers.py
"""
Shared utility functions used across the application.
"""
import hashlib
import math
import re
from pathlib import Path
from typing import TypeVar, Generic

T = TypeVar("T")


# ─── File Utilities ───────────────────────────────────────────────────────────

def sha256_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_filename(filename: str) -> str:
    """Strip path traversal attempts, keep extension."""
    name = Path(filename).name
    # Remove chars that could be problematic on Windows/Linux
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    return name[:200]  # cap at 200 chars


def human_readable_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 ** 2:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 ** 3:
        return f"{size_bytes / (1024**2):.1f} MB"
    return f"{size_bytes / (1024**3):.2f} GB"


# ─── Text Utilities ───────────────────────────────────────────────────────────

def estimate_tokens(text: str) -> int:
    """Rough estimate: ~4 chars per token (GPT-style)."""
    return max(1, len(text) // 4)


def truncate_text(text: str, max_chars: int = 500) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 3] + "..."


def normalize_whitespace(text: str) -> str:
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


# ─── Pagination ───────────────────────────────────────────────────────────────

def paginate(items: list, page: int, page_size: int) -> tuple[list, int]:
    """Simple in-memory pagination (use DB-level for large datasets)."""
    total = len(items)
    start = (page - 1) * page_size
    return items[start:start + page_size], total


def total_pages(total: int, page_size: int) -> int:
    return math.ceil(total / page_size) if page_size > 0 else 0


# ─── Sanitization ─────────────────────────────────────────────────────────────

def sanitize_tags(tags: list[str] | None) -> list[str]:
    """Deduplicate, lowercase, strip tags."""
    if not tags:
        return []
    seen = set()
    result = []
    for tag in tags:
        clean = tag.strip().lower()[:50]
        if clean and clean not in seen:
            seen.add(clean)
            result.append(clean)
    return result[:20]  # max 20 tags
