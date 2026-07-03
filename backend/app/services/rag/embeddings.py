"""
Embedding Service

Uses Ollama's nomic-embed-text model for local embeddings.
Compatible with Ollama 0.30.x (/api/embed endpoint).
"""

from functools import lru_cache

import httpx

from app.core.config import settings


class OllamaEmbedder:
    """
    Wraps Ollama embedding API.

    nomic-embed-text -> 768 dimension vectors
    """

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model = settings.OLLAMA_EMBED_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT

        print("=" * 80)
        print("OLLAMA BASE URL :", self.base_url)
        print("OLLAMA MODEL    :", self.model)
        print("OLLAMA TIMEOUT  :", self.timeout)
        print("=" * 80)

    def embed_text(self, text: str) -> list[float]:
        payload = {
            "model": self.model,
            "input": text,
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(
                f"{self.base_url}/api/embed",
                json=payload,
            )

            print(f"OLLAMA STATUS: {response.status_code}")

            if response.status_code != 200:
                print("OLLAMA RESPONSE:")
                print(response.text)

            response.raise_for_status()

            data = response.json()

            embeddings = data.get("embeddings")

            if not embeddings:
                raise RuntimeError(
                    f"No embeddings returned from Ollama. Response: {data}"
                )

            return embeddings[0]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Batch embedding.
        More efficient than one request per document.
        """

        payload = {
            "model": self.model,
            "input": texts,
        }

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(
                f"{self.base_url}/api/embed",
                json=payload,
            )

            print(f"OLLAMA BATCH STATUS: {response.status_code}")

            if response.status_code != 200:
                print("OLLAMA RESPONSE:")
                print(response.text)

            response.raise_for_status()

            data = response.json()

            embeddings = data.get("embeddings")

            if not embeddings:
                raise RuntimeError(
                    f"No embeddings returned from Ollama. Response: {data}"
                )

            return embeddings


@lru_cache(maxsize=1)
def get_embedder() -> OllamaEmbedder:
    return OllamaEmbedder()