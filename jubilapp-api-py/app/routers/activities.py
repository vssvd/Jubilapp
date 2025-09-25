from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore

from app.firebase import db
from app.schemas_activities import ActivityCreate, ActivityOut, ActivityUpdate
from app.security import get_current_uid


router = APIRouter(prefix="/activities", tags=["Activities"])


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _to_datetime(value: Optional[object]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif hasattr(value, "to_datetime"):
        dt = value.to_datetime()
    else:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _snapshot_to_activity(snapshot) -> ActivityOut:
    data = snapshot.to_dict() or {}

    date_time = _to_datetime(data.get("dateTime") or data.get("date_time"))
    created_at = _to_datetime(data.get("createdAt") or data.get("created_at"))

    payload = {
        "id": snapshot.id,
        "type": data.get("type"),
        "title": data.get("title"),
        "category": data.get("category"),
        "date_time": date_time,
        "location": data.get("location"),
        "link": data.get("link"),
        "origin": data.get("origin"),
        "created_at": created_at or datetime.now(timezone.utc),
    }

    return ActivityOut.model_validate(payload)


def _collection():
    return db.collection("activities")


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: ActivityCreate,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    doc_ref = _collection().document()
    data = payload.model_dump(by_alias=True, exclude_none=True)
    data.update({
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    doc_ref.set(data)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=500, detail="No se pudo guardar la actividad")
    return _snapshot_to_activity(snapshot)


@router.get("", response_model=List[ActivityOut])
def list_activities(
    *,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
    category: Optional[str] = Query(None),
    origin: Optional[str] = Query(None),
    activity_type: Optional[str] = Query(None, alias="type"),
    from_date: Optional[datetime] = Query(None, alias="fromDate"),
    to_date: Optional[datetime] = Query(None, alias="toDate"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = _collection()

    if category := _normalize_text(category):
        query = query.where("category", "==", category)
    if origin := _normalize_text(origin):
        query = query.where("origin", "==", origin)
    if activity_type := _normalize_text(activity_type):
        query = query.where("type", "==", activity_type)

    from_dt = _to_datetime(from_date)
    to_dt = _to_datetime(to_date)

    if from_dt:
        query = query.where("dateTime", ">=", from_dt)
    if to_dt:
        query = query.where("dateTime", "<=", to_dt)

    if from_dt or to_dt:
        query = query.order_by("dateTime", direction=firestore.Query.DESCENDING)
    query = query.order_by("createdAt", direction=firestore.Query.DESCENDING)

    query = query.limit(limit)
    if offset:
        query = query.offset(offset)

    snapshots = query.stream()
    activities: List[ActivityOut] = []
    for snap in snapshots:
        activities.append(_snapshot_to_activity(snap))
    return activities


@router.get("/{activity_id}", response_model=ActivityOut)
def get_activity(
    activity_id: str,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    snapshot = _collection().document(activity_id).get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return _snapshot_to_activity(snapshot)


@router.put("/{activity_id}", response_model=ActivityOut)
def update_activity(
    activity_id: str,
    payload: ActivityUpdate,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    doc_ref = _collection().document(activity_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")

    update_data = payload.model_dump(by_alias=True, exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Debes enviar al menos un campo para actualizar")

    update_data["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(update_data)

    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=500, detail="No se pudo refrescar la actividad")
    return _snapshot_to_activity(snapshot)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: str,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    doc_ref = _collection().document(activity_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    doc_ref.delete()
    return None
