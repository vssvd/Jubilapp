from __future__ import annotations

import os
import time
from math import sqrt
from typing import Iterable, List, Sequence

import requests

DEFAULT_MODEL_ID = "intfloat/multilingual-e5-small"
_MODEL_ID = os.getenv("HUGGINGFACE_MODEL_ID", DEFAULT_MODEL_ID)
_API_URL = os.getenv("HUGGINGFACE_API_URL") or f"https://api-inference.huggingface.co/models/{_MODEL_ID}"
_API_TOKEN = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HUGGINGFACE_TOKEN")

_SESSION = requests.Session()


class HuggingFaceConfigError(RuntimeError):
    pass


class HuggingFaceRequestError(RuntimeError):
    pass


def _headers() -> dict:
    headers = {"Accept": "application/json"}
    if _API_TOKEN:
        headers["Authorization"] = f"Bearer {_API_TOKEN}"
    return headers


def _mean_pooling(matrix: Sequence[Sequence[float]]) -> List[float]:
    length = len(matrix)
    if not length:
        return []
    dims = len(matrix[0]) if matrix[0] else 0
    if not dims:
        return []
    return [
        float(sum(row[i] for row in matrix) / length)
        for i in range(dims)
    ]


def _normalize(vec: Iterable[float]) -> List[float]:
    values = [float(v) for v in vec]
    norm = sqrt(sum(v * v for v in values)) or 0.0
    if norm == 0.0:
        return values
    return [v / norm for v in values]


def get_model_id() -> str:
    """Expose the model id resolved from configuration."""
    return _MODEL_ID


def embed_texts(texts: Sequence[str], *, normalize: bool = True, retries: int = 2, timeout: float = 30.0) -> List[List[float]]:
    cleaned = [t.strip() for t in texts if t and t.strip()]
    if not cleaned:
        return []
    if not _API_TOKEN:
        raise HuggingFaceConfigError("Falta configurar HUGGINGFACE_API_KEY")

    payload = {
        "inputs": cleaned,
        "options": {"wait_for_model": True},
    }

    attempt = 0
    last_error: Exception | None = None
    while attempt <= retries:
        try:
            response = _SESSION.post(_API_URL, headers=_headers(), json=payload, timeout=timeout)
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(min(2 ** attempt, 6))
            attempt += 1
            continue

        if response.status_code == 503 and "loading" in (response.text or "").lower():
            time.sleep(min(2 ** attempt, 6))
            attempt += 1
            continue

        if response.status_code == 401:
            raise HuggingFaceConfigError("Token de HuggingFace inválido")
        if response.status_code == 404:
            raise HuggingFaceRequestError(
                "El modelo de HuggingFace no está disponible para tu token. Verifica HUGGINGFACE_MODEL_ID y acepta las condiciones de uso del modelo en huggingface.co"
            )
        if response.status_code == 429:
            time.sleep(min(2 ** attempt, 6))
            attempt += 1
            continue
        if response.status_code >= 400:
            raise HuggingFaceRequestError(f"{response.status_code}: {response.text}")

        try:
            data = response.json()
        except ValueError as exc:
            raise HuggingFaceRequestError("Respuesta inválida del API de HuggingFace") from exc

        if isinstance(data, dict) and data.get("error"):
            # Algunos pipelines devuelven un dict con embeddings bajo "embeddings" o "data"
            if "embeddings" in data and isinstance(data["embeddings"], list):
                data = data["embeddings"]
            elif "data" in data and isinstance(data["data"], list):
                data = data["data"]
            else:
                raise HuggingFaceRequestError(str(data["error"]))

        # data debe ser lista (batch) con shape [batch, tokens, hidden]
        if not isinstance(data, list):
            raise HuggingFaceRequestError("Formato inesperado desde HuggingFace")

        sequences: List[Sequence[Sequence[float]]] = []
        if cleaned and len(data) == len(cleaned):
            sequences = data  # type: ignore[assignment]
        elif cleaned and len(data) == 1 and len(cleaned) == 1:
            sequences = data  # type: ignore[assignment]
        else:
            raise HuggingFaceRequestError("No se pudo alinear las respuestas del modelo")

        vectors: List[List[float]] = []
        for seq in sequences:
            # Caso 1: salida ya es un vector (p.ej., sentence-transformers)
            if isinstance(seq, list) and seq and all(isinstance(x, (int, float)) for x in seq):
                vec = [float(x) for x in seq]
                vectors.append(_normalize(vec) if normalize else vec)
                continue
            # Caso 2: salida es [tokens, hidden] (p.ej., BERT crudo / feature-extraction)
            if not isinstance(seq, list) or not seq or not isinstance(seq[0], list):
                raise HuggingFaceRequestError("Respuesta de embeddings inesperada")
            pooled = _mean_pooling(seq)  # type: ignore[arg-type]
            vectors.append(_normalize(pooled) if normalize else pooled)
        return vectors
