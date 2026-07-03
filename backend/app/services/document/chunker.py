# backend/app/services/document/chunker.py
"""
Text Chunker
Uses LangChain's RecursiveCharacterTextSplitter for context-aware chunking.
Returns chunks with metadata (page_number, chunk_index).
"""
from dataclasses import dataclass
from langchain.text_splitter import RecursiveCharacterTextSplitter
from app.core.config import settings
from app.services.document.parser import ParsedDocument, PageContent


@dataclass
class TextChunk:
    chunk_index: int
    page_number: int
    content: str
    char_count: int
    token_estimate: int  # rough: chars / 4


def chunk_parsed_document(parsed: ParsedDocument) -> list[TextChunk]:
    """
    Chunk each page independently so page_number metadata stays accurate,
    then re-index globally.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    all_chunks: list[TextChunk] = []
    global_index = 0

    for page in parsed.pages:
        if not page.text.strip():
            continue
        splits = splitter.split_text(page.text)
        for split in splits:
            text = split.strip()
            if not text:
                continue
            all_chunks.append(TextChunk(
                chunk_index=global_index,
                page_number=page.page_number,
                content=text,
                char_count=len(text),
                token_estimate=max(1, len(text) // 4),
            ))
            global_index += 1

    return all_chunks
