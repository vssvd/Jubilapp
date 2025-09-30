from __future__ import annotations

import hashlib
from functools import lru_cache
from typing import Dict, List, Optional, Sequence, Tuple

from firebase_admin import firestore

from app.firebase import db
from app.services.huggingface import HuggingFaceRequestError, embed_texts, get_model_id
from app.services.interests_catalog import ensure_catalog_firestore


InterestRow = Dict[str, Optional[str | int]]
CatalogEmbedding = Tuple[InterestRow, List[float]]


def _field_prefix() -> str:
    model = get_model_id().lower()
    sanitized = "".join(ch if ch.isalnum() else "_" for ch in model)
    sanitized = sanitized.strip("_") or "model"
    return f"embedding_{sanitized}"


def _vector_field() -> str:
    return f"{_field_prefix()}_vector"


def _signature_field() -> str:
    return f"{_field_prefix()}_signature"


def _text_field() -> str:
    return f"{_field_prefix()}_text"


def _updated_field() -> str:
    return f"{_field_prefix()}_updated_at"


def _passage_payload(name: str, category: Optional[str]) -> str:
    main = name.strip()
    if category:
        main = f"{category.strip()} — {main}"
    return f"passage: {main}"


def _signature(payload: str) -> str:
    raw = f"{get_model_id()}||{payload}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()


def ensure_catalog_embeddings(force: bool = False) -> None:
    """Ensure every interest in Firestore has a cached embedding for the active model."""

    ensure_catalog_firestore()

    snapshots = list(db.collection("interests_catalog").stream())
    if not snapshots:
        return

    vector_field = _vector_field()
    signature_field = _signature_field()
    text_field = _text_field()
    updated_field = _updated_field()

    pending_refs: List = []
    payloads: List[str] = []
    signatures: List[str] = []

    for snapshot in snapshots:
        data = snapshot.to_dict() or {}
        name = (data.get("name") or "").strip()
        category = (data.get("category") or None)
        if not name:
            continue

        payload = _passage_payload(name, category)
        sig = _signature(payload)

        has_vector = isinstance(data.get(vector_field), list) and data.get(vector_field)
        matches_signature = data.get(signature_field) == sig

        if force or not has_vector or not matches_signature:
            pending_refs.append(snapshot.reference)
            payloads.append(payload)
            signatures.append(sig)

    if not pending_refs:
        return

    vectors = embed_texts(payloads)
    if len(vectors) != len(pending_refs):
        raise HuggingFaceRequestError("No se pudieron generar embeddings para el catálogo de intereses")

    chunk_size = 300  # Firestore batch limit safeguard
    for start in range(0, len(pending_refs), chunk_size):
        batch = db.batch()
        for ref, vec, sig, payload in zip(
            pending_refs[start:start + chunk_size],
            vectors[start:start + chunk_size],
            signatures[start:start + chunk_size],
            payloads[start:start + chunk_size],
        ):
            batch.set(
                ref,
                {
                    vector_field: [float(v) for v in vec],
                    signature_field: sig,
                    text_field: payload,
                    updated_field: firestore.SERVER_TIMESTAMP,
                },
                merge=True,
            )
        batch.commit()

    # Refresh memoized data if it exists
    try:
        load_interest_embeddings.cache_clear()  # type: ignore[attr-defined]
    except Exception:
        pass


@lru_cache(maxsize=1)
def load_interest_embeddings() -> List[CatalogEmbedding]:
    """Return catalog entries with their precomputed embedding vectors."""

    ensure_catalog_embeddings()

    snapshots = list(db.collection("interests_catalog").stream())
    vector_field = _vector_field()

    embeddings: List[CatalogEmbedding] = []
    for snapshot in snapshots:
        data = snapshot.to_dict() or {}
        name = (data.get("name") or "").strip()
        if not name:
            continue

        try:
            iid = int(data.get("id") or (snapshot.id if str(snapshot.id).isdigit() else 0))
        except Exception:
            iid = 0

        vector_raw = data.get(vector_field)
        if not isinstance(vector_raw, Sequence) or not vector_raw:
            continue

        vector = [float(v) for v in vector_raw]
        row: InterestRow = {
            "id": iid,
            "name": name,
            "category": data.get("category"),
        }
        embeddings.append((row, vector))

    embeddings.sort(key=lambda item: ((item[0].get("category") or ""), (item[0].get("name") or "")))

    if not embeddings:
        raise HuggingFaceRequestError(
            "No hay embeddings almacenados para el catálogo de intereses. Ejecuta ensure_catalog_embeddings()"
        )

    return embeddings


__all__ = [
    "CatalogEmbedding",
    "InterestRow",
    "ensure_catalog_embeddings",
    "load_interest_embeddings",
]
