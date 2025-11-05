from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import math
import unicodedata
from typing import Dict, Iterable, Optional, Set, Tuple

from app.domain_activities import ATEMPORAL_ACTIVITIES, get_category_for_activity
from app.firebase import db
from app.services.activity_reports import list_reports


@dataclass(frozen=True)
class CategoryPreferenceProfile:
    weights: Dict[str, float]
    labels: Dict[str, str]
    reported_atemporal_ids: Set[int]

    def weight_for(self, category: Optional[str]) -> float:
        token = _normalize_category_token(category)
        if token is None:
            return 0.0
        return self.weights.get(token, 0.0)


def get_user_category_preferences(uid: str, *, history_limit: int = 120) -> CategoryPreferenceProfile:
    favorite_counts, favorite_labels = _favorite_category_counts(uid)
    history_counts, history_labels = _history_category_counts(uid, limit=history_limit)
    rating_weights, rating_labels = _history_feedback_weights(uid, limit=history_limit)
    penalty_counts, penalty_labels, reported_ids = _reported_category_counts(uid)

    weights: Dict[str, float] = {}
    labels: Dict[str, str] = {}

    _apply_weights(
        weights,
        labels,
        favorite_counts,
        favorite_labels,
        _favorite_weight,
    )
    _apply_weights(
        weights,
        labels,
        history_counts,
        history_labels,
        _history_weight,
    )
    _apply_weights(
        weights,
        labels,
        rating_weights,
        rating_labels,
        lambda value: value,
    )
    _apply_weights(
        weights,
        labels,
        penalty_counts,
        penalty_labels,
        lambda count: -_penalty_weight(count),
    )

    normalized_weights = {
        token: round(value, 3)
        for token, value in weights.items()
        if abs(value) >= 0.25
    }

    return CategoryPreferenceProfile(
        weights=normalized_weights,
        labels=labels,
        reported_atemporal_ids=reported_ids,
    )


def _apply_weights(
    weights: Dict[str, float],
    labels: Dict[str, str],
    counts: Counter,
    name_map: Dict[str, str],
    transform,
) -> None:
    for token, count in counts.items():
        if count <= 0:
            continue
        value = transform(count)
        if value == 0:
            continue
        weights[token] = weights.get(token, 0.0) + value
        if token not in labels and token in name_map:
            labels[token] = name_map[token]


def _favorite_weight(count: int) -> float:
    return min(8.0, 3.0 + 2.5 * math.log(count + 1))


def _history_weight(count: int) -> float:
    return min(5.0, 1.5 + 1.5 * math.log(count + 1))


def _penalty_weight(count: int) -> float:
    return min(9.0, 3.0 + 3.0 * math.log(count + 1))


def _favorite_category_counts(uid: str) -> Tuple[Counter, Dict[str, str]]:
    collection = db.collection("users").document(uid).collection("activityFavorites")
    query = collection.where("activityType", "==", "atemporal")
    counts: Counter = Counter()
    labels: Dict[str, str] = {}
    snapshots = query.stream()

    for snap in snapshots:
        data = snap.to_dict() or {}
        category = _resolve_category(data, fallback_id=snap.id)
        token = _normalize_category_token(category)
        if token:
            counts[token] += 1
            if token not in labels and category:
                labels[token] = category

    return counts, labels


def _history_category_counts(uid: str, *, limit: int) -> Tuple[Counter, Dict[str, str]]:
    collection = db.collection("users").document(uid).collection("activityHistory")
    query = collection.where("type", "==", "atemporal").limit(limit)
    counts: Counter = Counter()
    labels: Dict[str, str] = {}
    snapshots = query.stream()

    for snap in snapshots:
        data = snap.to_dict() or {}
        category = _resolve_category(data, fallback_id=snap.id)
        token = _normalize_category_token(category)
        if token:
            counts[token] += 1
            if token not in labels and category:
                labels[token] = category

    return counts, labels


def _reported_category_counts(uid: str) -> Tuple[Counter, Dict[str, str], Set[int]]:
    rows = list_reports(uid)
    counts: Counter = Counter()
    labels: Dict[str, str] = {}
    reported_ids: Set[int] = set()

    for row in rows:
        category = getattr(row, "category", None)
        token = _normalize_category_token(category)
        if token:
            counts[token] += 1
            if token not in labels and category:
                labels[token] = category
        if getattr(row, "activity_type", None) == "atemporal":
            atemporal_id = _atemporal_numeric_id(row.activity_id)
            if atemporal_id is not None:
                reported_ids.add(atemporal_id)

    return counts, labels, reported_ids


def _history_feedback_weights(uid: str, *, limit: int) -> Tuple[Dict[str, float], Dict[str, str]]:
    collection = db.collection("users").document(uid).collection("activityHistory")
    query = collection.where("type", "==", "atemporal").limit(limit)
    weights: Dict[str, float] = {}
    labels: Dict[str, str] = {}
    snapshots = query.stream()

    for snap in snapshots:
        data = snap.to_dict() or {}
        rating = _resolve_rating(data)
        if rating is None:
            continue
        category = _resolve_category(data, fallback_id=snap.id)
        token = _normalize_category_token(category)
        if not token:
            continue
        adjustment = _rating_weight_adjustment(rating)
        if adjustment == 0:
            continue
        weights[token] = weights.get(token, 0.0) + adjustment
        if token not in labels and category:
            labels[token] = category

    return weights, labels


def _normalize_category_token(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = unicodedata.normalize("NFKD", value)
    cleaned = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    token = cleaned.lower().strip()
    return token or None


_ATEMPORAL_BY_ID: Dict[int, Dict] = {}
for item in ATEMPORAL_ACTIVITIES:
    try:
        raw_id = item.get("id")
        numeric_id = int(raw_id)
    except (AttributeError, TypeError, ValueError):
        continue
    _ATEMPORAL_BY_ID[numeric_id] = item


def _atemporal_numeric_id(raw: object) -> Optional[int]:
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        if raw.is_integer():
            return int(raw)
        return None
    text = str(raw).strip().lower()
    if not text:
        return None
    prefixes = ("atemporal-", "atemporal_", "atemporal::", "atemporal ")
    for prefix in prefixes:
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    if text.startswith("atemporal"):
        text = text.replace("atemporal", "", 1)
    text = text.strip(":_- ")
    if text.isdigit():
        return int(text)
    return None


def _resolve_category(data: Dict, *, fallback_id: Optional[str] = None) -> Optional[str]:
    explicit = data.get("category")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()

    activity_id = (
        data.get("activityId")
        or data.get("activity_id")
        or fallback_id
    )
    numeric_id = _atemporal_numeric_id(activity_id)
    if numeric_id is not None:
        catalog_entry = _ATEMPORAL_BY_ID.get(numeric_id)
        if catalog_entry:
            category = get_category_for_activity(catalog_entry)
            if category:
                return category

    tags = data.get("tags")
    if isinstance(tags, Iterable) and not isinstance(tags, (str, bytes)):
        for tag in tags:
            if isinstance(tag, str):
                cleaned = tag.strip()
                if cleaned:
                    return cleaned

    return None


def _resolve_rating(data: Dict) -> Optional[int]:
    raw = (
        data.get("rating")
        or data.get("feedbackRating")
        or data.get("feedback_rating")
    )
    if raw is None:
        return None
    if isinstance(raw, bool):
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if 1 <= value <= 5:
        return value
    return None


def _rating_weight_adjustment(rating: int) -> float:
    if rating >= 5:
        return 3.0
    if rating == 4:
        return 1.5
    if rating == 3:
        return 0.5
    if rating == 2:
        return -1.5
    return -3.0
