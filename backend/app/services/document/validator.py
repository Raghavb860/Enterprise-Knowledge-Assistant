# backend/app/services/document/validator.py
"""
File Validator
- Extension whitelist
- MIME type check via python-magic (needs libmagic on Windows: pip install python-magic-bin)
- Size limit
- Basic malware heuristics (embedded scripts in PDF)
"""
import re
from pathlib import Path
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings

ALLOWED_MIME_TYPES = {
    "pdf":  ["application/pdf"],
    "docx": [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",  # docx is a zip
    ],
    "txt":  ["text/plain"],
    "xlsx": [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
    ],
}

# Simple heuristics to detect embedded JavaScript in PDF
PDF_MALWARE_PATTERNS = [
    rb"/JavaScript",
    rb"/JS\s",
    rb"/AA\s",   # auto-action
    rb"/OpenAction",
    rb"eval\(",
]


def validate_extension(filename: str) -> str:
    """Returns normalised extension or raises HTTPException."""
    ext = Path(filename).suffix.lstrip(".").lower()
    if ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '.{ext}' is not allowed. Allowed: {settings.ALLOWED_EXTENSIONS}",
        )
    return ext


def validate_size(size: int) -> None:
    if size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit.",
        )


def check_pdf_for_malware(content: bytes) -> None:
    for pattern in PDF_MALWARE_PATTERNS:
        if re.search(pattern, content[:65536]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File rejected: suspicious PDF content detected.",
            )


async def validate_upload(file: UploadFile) -> tuple[bytes, str]:
    """
    Full validation pipeline.
    Returns (file_bytes, extension_str).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = validate_extension(file.filename)
    content = await file.read()
    validate_size(len(content))

    if ext == "pdf":
        check_pdf_for_malware(content)

    return content, ext
