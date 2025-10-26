from __future__ import annotations

import logging
import os
import time
from math import sqrt
from typing import Any, Iterable, List, Sequence

import requests

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - dependencia opcional
    SentenceTransformer = None  # type: ignore[assignment]

DEFAULT_MODEL_ID = "intfloat/multilingual-e5-small"
_MODEL_ID = os.getenv("HUGGINGFACE_MODEL_ID", DEFAULT_MODEL_ID)
_API_URL = os.getenv("HUGGINGFACE_API_URL") or f"https://api-inference.huggingface.co/models/{_MODEL_ID}"
_API_TOKEN = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HUGGINGFACE_TOKEN")

_SESSION = requests.Session()
_LOGGER = logging.getLogger(__name__)


class HuggingFaceConfigError(RuntimeError):
    pass


class HuggingFaceRequestError(RuntimeError):
    pass


def _headers() -> dict:
    headers = {"Accept": "application/json"}
    if _API_TOKEN:
        headers["Authorization"] = f"Bearer {_API_TOKEN}"
    return headers


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


_FORCE_LOCAL = _env_flag("HUGGINGFACE_FORCE_LOCAL")
_FORCE_REMOTE = _env_flag("HUGGINGFACE_FORCE_REMOTE")

try:
    _LOCAL_BATCH_SIZE = int(os.getenv("HUGGINGFACE_BATCH_SIZE", "16"))
except ValueError:
    _LOCAL_BATCH_SIZE = 16
_LOCAL_BATCH_SIZE = max(1, min(_LOCAL_BATCH_SIZE, 128))

_LOCAL_MODEL: Any | None = None
_LOCAL_MODEL_ERROR: Exception | None = None


def _load_local_model():
    global _LOCAL_MODEL, _LOCAL_MODEL_ERROR

    if _LOCAL_MODEL is not None:
        return _LOCAL_MODEL
    if _LOCAL_MODEL_ERROR is not None:
        raise _LOCAL_MODEL_ERROR

    if SentenceTransformer is None:
        error = HuggingFaceConfigError(
            "Instala sentence-transformers==3.0.1 para usar el modelo de embeddings local."
        )
        _LOCAL_MODEL_ERROR = error
        raise error

    model_source = os.getenv("HUGGINGFACE_MODEL_PATH") or _MODEL_ID
    device = os.getenv("HUGGINGFACE_DEVICE", "cpu")

    try:
        _LOCAL_MODEL = SentenceTransformer(model_source, device=device)
    except Exception as exc:  # pragma: no cover - inicialización dependiente del entorno
        error = HuggingFaceRequestError(f"No se pudo cargar el modelo local '{model_source}': {exc}")
        _LOCAL_MODEL_ERROR = error
        raise error from exc

    return _LOCAL_MODEL


def _embed_texts_local(texts: Sequence[str], *, normalize: bool) -> List[List[float]]:
    model = _load_local_model()
    try:
        vectors = model.encode(
            list(texts),
            batch_size=_LOCAL_BATCH_SIZE,
            convert_to_numpy=True,
            normalize_embeddings=normalize,
            show_progress_bar=False,
        )
    except Exception as exc:  # pragma: no cover - ejecución dependiente del entorno
        raise HuggingFaceRequestError(f"Error generando embeddings con el modelo local: {exc}") from exc

    if hasattr(vectors, "tolist"):
        raw_vectors = vectors.tolist()
    else:
        raw_vectors = vectors
    return [[float(value) for value in row] for row in raw_vectors]


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


def _embed_texts_remote(
    texts: Sequence[str],
    *,
    normalize: bool,
    retries: int,
    timeout: float,
) -> List[List[float]]:
    payload = {
        "inputs": texts,
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
            if "embeddings" in data and isinstance(data["embeddings"], list):
                data = data["embeddings"]
            elif "data" in data and isinstance(data["data"], list):
                data = data["data"]
            else:
                raise HuggingFaceRequestError(str(data["error"]))

        if not isinstance(data, list):
            raise HuggingFaceRequestError("Formato inesperado desde HuggingFace")

        sequences: List[Sequence[Sequence[float]]] = []
        if texts and len(data) == len(texts):
            sequences = data  # type: ignore[assignment]
        elif texts and len(data) == 1 and len(texts) == 1:
            sequences = data  # type: ignore[assignment]
        else:
            raise HuggingFaceRequestError("No se pudo alinear las respuestas del modelo")

        vectors: List[List[float]] = []
        for seq in sequences:
            if isinstance(seq, list) and seq and all(isinstance(x, (int, float)) for x in seq):
                vec = [float(x) for x in seq]
                vectors.append(_normalize(vec) if normalize else vec)
                continue
            if not isinstance(seq, list) or not seq or not isinstance(seq[0], list):
                raise HuggingFaceRequestError("Respuesta de embeddings inesperada")
            pooled = _mean_pooling(seq)  # type: ignore[arg-type]
            vectors.append(_normalize(pooled) if normalize else pooled)
        return vectors

    raise HuggingFaceRequestError(f"No se pudo obtener respuesta del API de HuggingFace: {last_error}")


def get_model_id() -> str:
    """Expose the model id resolved from configuration."""
    return _MODEL_ID


def embed_texts(texts: Sequence[str], *, normalize: bool = True, retries: int = 2, timeout: float = 30.0) -> List[List[float]]:
    cleaned = [t.strip() for t in texts if t and t.strip()]
    if not cleaned:
        return []

    last_error: Exception | None = None

    prefer_local = not _FORCE_REMOTE
    if prefer_local:
        try:
            return _embed_texts_local(cleaned, normalize=normalize)
        except (HuggingFaceConfigError, HuggingFaceRequestError) as exc:
            last_error = exc
            _LOGGER.debug("Fallo modelo HuggingFace local, intentando API remota si está disponible", exc_info=exc)
            if _FORCE_LOCAL:
                raise

    if _API_TOKEN and not _FORCE_LOCAL:
        try:
            return _embed_texts_remote(cleaned, normalize=normalize, retries=retries, timeout=timeout)
        except HuggingFaceRequestError as exc:
            last_error = exc

    if last_error is not None:
        raise last_error

    if prefer_local:
        raise HuggingFaceConfigError(
            "No se pudo cargar el modelo local y no hay API configurada. Instala sentence-transformers y descarga el modelo."
        )

    raise HuggingFaceConfigError("Falta configurar HUGGINGFACE_API_KEY")
