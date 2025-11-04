from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional, Sequence, Tuple
import unicodedata

from app.domain_preparation import validate_level
from app.domain_mobility import ALLOWED_MOBILITY_LEVELS, validate_mobility_level
from app.services.huggingface import (
    HuggingFaceConfigError,
    HuggingFaceRequestError,
    embed_texts,
)
from app.services.catalog_embeddings import InterestRow, load_interest_embeddings

PREPARATION_REFERENCES: Dict[str, List[str]] = {
    "planificado": [
        "Tengo un plan organizado con actividades claras para mi jubilación.",
        "Sé exactamente qué quiero hacer y ya tengo un calendario definido.",
    ],
    "intermedio": [
        "Tengo ideas de lo que quiero hacer, pero aún no lo he estructurado.",
        "Sé algunas actividades que me gustan, pero necesito ordenarlas mejor.",
    ],
    "desorientado": [
        "No tengo claro qué hacer con mi tiempo libre y necesito orientación.",
        "Me siento perdido y no sé por dónde empezar a organizar actividades.",
    ],
}

MIN_INTEREST_SCORE = 0.33
MOBILITY_LEVELS = ALLOWED_MOBILITY_LEVELS
MOBILITY_KEYWORDS: Dict[str, List[str]] = {
    "baja": [
        "movilidad baja",
        "movilidad reducida",
        "movilidad limitada",
        "dificultad para moverme",
        "me cuesta caminar",
        "me canso rapido",
        "uso baston",
        "uso andador",
        "necesito ayuda",
        "dolor al caminar",
        "salgo poco",
        "poca movilidad",
    ],
    "media": [
        "movilidad media",
        "movilidad moderada",
        "algo limitada",
        "me canso un poco",
        "distancias cortas",
        "regular",
    ],
    "alta": [
        "movilidad alta",
        "movilidad buena",
        "sin problemas para moverme",
        "sin problema para moverme",
        "camino bien",
        "sin limitaciones",
        "soy activo",
        "soy activa",
        "hago ejercicio",
        "movilidad plena",
    ],
}
MOBILITY_EXACT_MATCHES: Dict[str, str] = {
    "baja": "baja",
    "limitada": "baja",
    "reducida": "baja",
    "media": "media",
    "moderada": "media",
    "normal": "media",
    "alta": "alta",
    "buena": "alta",
    "excelente": "alta",
}


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return float(sum(x * y for x, y in zip(a, b)))


def _interest_suggestions(answers: Sequence[str], top_k: int) -> List[Dict]:
    cleaned = [a.strip() for a in answers if a and a.strip()]
    if not cleaned:
        return []

    query_payloads = [f"query: {text}" for text in cleaned]
    answer_vectors = embed_texts(query_payloads)
    if len(answer_vectors) != len(cleaned):
        raise HuggingFaceRequestError("No se pudieron generar embeddings de las respuestas")

    catalog_vectors = load_interest_embeddings()

    scored: List[Tuple[float, InterestRow]] = []
    for row, vec in catalog_vectors:
        sims = [_dot(vec, ans) for ans in answer_vectors]
        best = max(sims) if sims else -1.0
        scored.append((best, row))

    scored.sort(key=lambda item: item[0], reverse=True)

    suggestions: List[Dict] = []
    for score, row in scored[: max(1, top_k)]:
        if score < MIN_INTEREST_SCORE and suggestions:
            break
        suggestions.append({
            "id": int(row.get("id") or 0),
            "name": row.get("name") or "",
            "category": row.get("category"),
            "score": round(float(score), 3),
        })
    # Si ninguna supera el umbral, conserva la mejor para no devolver vacío
    if not suggestions and scored:
        best_score, best_row = scored[0]
        suggestions.append({
            "id": int(best_row.get("id") or 0),
            "name": best_row.get("name") or "",
            "category": best_row.get("category"),
            "score": round(float(best_score), 3),
        })
    return suggestions


@lru_cache(maxsize=1)
def _preparation_reference_vectors() -> Dict[str, List[List[float]]]:
    rows: List[Tuple[str, str]] = []
    for level, phrases in PREPARATION_REFERENCES.items():
        for phrase in phrases:
            rows.append((level, phrase))
    texts = [f"passage: {r[1]}" for r in rows]
    vectors = embed_texts(texts)
    if len(vectors) != len(rows):
        raise HuggingFaceRequestError("No se pudieron generar embeddings de referencia")
    grouped: Dict[str, List[List[float]]] = {key: [] for key in PREPARATION_REFERENCES.keys()}
    for (level, _), vec in zip(rows, vectors):
        grouped[level].append(vec)
    return grouped


def _classify_preparation(answer: Optional[str]) -> Optional[str]:
    text = (answer or "").strip()
    if not text:
        return None

    answer_vecs = embed_texts([f"query: {text}"])
    if not answer_vecs:
        return None
    answer_vec = answer_vecs[0]

    best_level: Optional[str] = None
    best_score = -1.0
    for level, vectors in _preparation_reference_vectors().items():
        for vec in vectors:
            score = _dot(answer_vec, vec)
            if score > best_score:
                best_score = score
                best_level = level

    if best_level is None:
        return None
    if best_score < 0.25:
        return None
    return validate_level(best_level)


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).lower().strip()


def _classify_mobility(answer: Optional[str]) -> Optional[str]:
    text = (answer or "").strip()
    if not text:
        return None

    normalized = _normalize_text(text)
    if not normalized:
        return None

    tokens = {word.strip() for word in normalized.split() if word.strip()}
    for token in tokens:
        mapped = MOBILITY_EXACT_MATCHES.get(token)
        if mapped:
            return validate_mobility_level(mapped)

    for level in MOBILITY_LEVELS:
        phrase = f"movilidad {level}"
        if phrase in normalized:
            return validate_mobility_level(level)

    scores: Dict[str, int] = {level: 0 for level in MOBILITY_LEVELS}
    for level, keywords in MOBILITY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in normalized:
                scores[level] += 2

    best_level = max(scores, key=lambda key: scores[key])
    if scores[best_level] > 0:
        return validate_mobility_level(best_level)

    return None


def analyze_questionnaire(
    *,
    interest_answers: Sequence[str] | None,
    preparation_answer: Optional[str],
    mobility_answer: Optional[str],
    top_k: int,
) -> Dict:
    try:
        interests = _interest_suggestions(interest_answers or [], top_k)
        preparation = _classify_preparation(preparation_answer)
        mobility = _classify_mobility(mobility_answer)
    except (HuggingFaceConfigError, HuggingFaceRequestError):
        raise
    return {
        "interests": interests,
        "preparation_level": preparation,
        "mobility_level": mobility,
    }
