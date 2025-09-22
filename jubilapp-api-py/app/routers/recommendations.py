from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.firebase import db
from app.security import get_current_uid
from app.domain_activities import recommend_atemporales
from app.schemas_recommendations import (
    AtemporalRecommendationsOut,
    AtemporalActivityOut,
    TimeOfDay,
)


router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


def _user_interests(uid: str) -> List[str]:
    doc = db.collection("users").document(uid).get()
    data = doc.to_dict() or {}
    names = [n for n in (data.get("interests") or []) if isinstance(n, str)]
    if names:
        return names
    # fallback por ids si no hay nombres
    ids = [int(i) for i in (data.get("interest_ids") or []) if isinstance(i, int) or (isinstance(i, str) and i.isdigit())]
    if not ids:
        return []
    by_id = {}
    for d in db.collection("interests_catalog").stream():
        row = d.to_dict() or {}
        try:
            iid = int(row.get("id") or (d.id if str(d.id).isdigit() else 0))
        except Exception:
            continue
        by_id[iid] = row.get("name") or ""
    return [by_id[i] for i in ids if i in by_id and by_id[i]]


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

