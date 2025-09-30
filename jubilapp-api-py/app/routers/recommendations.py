from typing import List, Optional
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


@router.get("/atemporales", response_model=AtemporalRecommendationsOut)
def get_atemporal_recommendations(
    limit: int = Query(8, ge=1, le=30),
    time_of_day: Optional[TimeOfDay] = Query(None, alias="tod"),
    uid: str = Depends(get_current_uid),
):
    interests = _user_interests(uid)
    level = _user_preparation_level(uid)
    rows = recommend_atemporales(interests, level, limit=limit, time_of_day=time_of_day)
    return {
        "activities": [AtemporalActivityOut(**r) for r in rows]
    }
