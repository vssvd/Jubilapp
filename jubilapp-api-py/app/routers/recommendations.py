from typing import List, Optional, Set
from fastapi import APIRouter, Depends, Query
from app.firebase import db
from app.security import get_current_uid
from app.domain_activities import recommend_atemporales
from app.services.user_interests import get_user_interest_names
from app.schemas_recommendations import (
    AtemporalRecommendationsOut,
    AtemporalActivityOut,
    TimeOfDay,
)


router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def _user_interests(uid: str) -> List[str]:
    return get_user_interest_names(uid)


def _user_preparation_level(uid: str) -> Optional[str]:
    doc = db.collection("users").document(uid).get()
    data = doc.to_dict() or {}
    lvl = data.get("preparation_level")
    if lvl in ("planificado", "intermedio", "desorientado"):
        return lvl
    return None


def _favorite_atemporal_tokens(uid: str) -> Set[str]:
    collection = db.collection("users").document(uid).collection("activityFavorites")
    snapshots = collection.where("activityType", "==", "atemporal").stream()
    tokens: Set[str] = set()
    for snap in snapshots:
        data = snap.to_dict() or {}
        raw = data.get("activityId") or data.get("activity_id") or snap.id
        if isinstance(raw, str):
            cleaned = raw.strip()
            if cleaned:
                tokens.add(cleaned)
        elif isinstance(raw, int):
            tokens.add(f"atemporal-{raw}")
    return tokens


@router.get("/atemporales", response_model=AtemporalRecommendationsOut)
def get_atemporal_recommendations(
    limit: int = Query(8, ge=1, le=30),
    categories: Optional[List[str]] = Query(
        None,
        description="Filtra por categorías (p. ej. cognitiva, social, física). Puede repetirse.",
    ),
    time_of_day: Optional[TimeOfDay] = Query(None, alias="tod"),
    uid: str = Depends(get_current_uid),
):
    interests = _user_interests(uid)
    level = _user_preparation_level(uid)
    rows = recommend_atemporales(
        interests,
        level,
        limit=limit,
        categories=categories,
        time_of_day=time_of_day,
    )
    favorite_tokens = _favorite_atemporal_tokens(uid)
    activities: List[AtemporalActivityOut] = []
    for row in rows:
        item = dict(row)
        token = f"atemporal-{item.get('id')}"
        item["is_favorite"] = token in favorite_tokens
        activities.append(AtemporalActivityOut(**item))
    return {"activities": activities}
