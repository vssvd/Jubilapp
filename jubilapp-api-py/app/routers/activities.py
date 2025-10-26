from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from firebase_admin import firestore
from pydantic import ValidationError

from app.firebase import db
from app.schemas_activities import (
    ActivityCreate,
    ActivityHistoryCreate,
    ActivityHistoryOut,
    ActivityOut,
    ActivityUpdate,
    ActivityFavoriteCreate,
    ActivityFavoriteOut,
    ActivitiesSeedSummary,
    ActivitiesSyncSummary,
)
from app.security import get_current_uid, get_current_uid_or_task
from app.services.activities_seed import seed_atemporal_activities
from app.services.activities_sync_ics import sync_ics_events
from app.services.user_interests import get_user_interest_names


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


def _normalize_tags(value: Optional[object]) -> Optional[List[str]]:
    if value is None:
        return None
    candidates: List[str] = []
    if isinstance(value, str):
        parts = [chunk.strip() for chunk in value.split(",")]
        for text in parts:
            if text and text not in candidates:
                candidates.append(text)
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            if isinstance(item, str):
                text = item.strip()
                if "," in text:
                    for chunk in (segment.strip() for segment in text.split(",")):
                        if chunk and chunk not in candidates:
                            candidates.append(chunk)
                    continue
                if text and text not in candidates:
                    candidates.append(text)
    return candidates or None


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
        "tags": _normalize_tags(data.get("tags")),
    }

    return ActivityOut.model_validate(payload)


def _collection():
    return db.collection("activities")


def _history_collection(uid: str):
    return db.collection("users").document(uid).collection("activityHistory")


def _favorites_collection(uid: str):
    return db.collection("users").document(uid).collection("activityFavorites")


def _snapshot_to_history(snapshot) -> ActivityHistoryOut:
    data = snapshot.to_dict() or {}

    completed_at = _to_datetime(data.get("completedAt") or data.get("completed_at"))
    created_at = _to_datetime(data.get("createdAt") or data.get("created_at")) or datetime.now(timezone.utc)
    updated_at = _to_datetime(data.get("updatedAt") or data.get("updated_at"))

    payload = {
        "id": snapshot.id,
        "activity_id": data.get("activityId") or data.get("activity_id"),
        "title": data.get("title"),
        "emoji": data.get("emoji"),
        "category": data.get("category"),
        "type": data.get("type"),
        "origin": data.get("origin"),
        "date_time": _to_datetime(data.get("dateTime") or data.get("date_time")),
        "completed_at": completed_at or created_at,
        "created_at": created_at,
        "updated_at": updated_at,
        "tags": _normalize_tags(data.get("tags")),
        "notes": data.get("notes"),
    }

    return ActivityHistoryOut.model_validate(payload)


def _snapshot_to_favorite(snapshot) -> ActivityFavoriteOut:
    data = snapshot.to_dict() or {}

    created_at = _to_datetime(data.get("createdAt") or data.get("created_at")) or datetime.now(timezone.utc)
    updated_at = _to_datetime(data.get("updatedAt") or data.get("updated_at"))

    payload = {
        "id": snapshot.id,
        "activity_id": data.get("activityId") or data.get("activity_id") or snapshot.id,
        "activity_type": data.get("activityType") or data.get("activity_type"),
        "title": data.get("title"),
        "emoji": data.get("emoji"),
        "category": data.get("category"),
        "origin": data.get("origin"),
        "link": data.get("link"),
        "date_time": _to_datetime(data.get("dateTime") or data.get("date_time")),
        "tags": _normalize_tags(data.get("tags")),
        "source": data.get("source"),
        "created_at": created_at,
        "updated_at": updated_at,
    }

    return ActivityFavoriteOut.model_validate(payload)


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
    interests: Optional[List[str]] = Query(
        None,
        description="Filtra por nombres de intereses; puede repetirse",
    ),
    match_my_interests: bool = Query(
        False,
        alias="matchMyInterests",
        description="Si es true, usa los intereses del usuario autenticado",
    ),
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

    interest_filters: Optional[List[str]] = None
    if interests or match_my_interests:
        raw_filters: List[str] = []
        if interests:
            raw_filters.extend(interests)
        if match_my_interests:
            raw_filters.extend(get_user_interest_names(uid))
        interest_filters = _normalize_tags(raw_filters)
        if interest_filters:
            if len(interest_filters) > 10:
                interest_filters = interest_filters[:10]
            query = query.where("tags", "array_contains_any", interest_filters)

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


@router.post("/history", response_model=ActivityHistoryOut, status_code=status.HTTP_201_CREATED)
def create_history_entry(
    payload: ActivityHistoryCreate,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    collection = _history_collection(uid)
    doc_ref = collection.document()

    data = payload.model_dump(by_alias=True, exclude_none=True)
    if "completedAt" not in data:
        data["completedAt"] = firestore.SERVER_TIMESTAMP

    timestamps = {
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    doc_ref.set({**data, **timestamps})
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=500, detail="No se pudo guardar el historial")
    return _snapshot_to_history(snapshot)


@router.get("/history", response_model=List[ActivityHistoryOut])
def list_history_entries(
    *,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
    category: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None, alias="fromDate"),
    to_date: Optional[datetime] = Query(None, alias="toDate"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = _history_collection(uid)

    if category := _normalize_text(category):
        query = query.where("category", "==", category)

    from_dt = _to_datetime(from_date)
    to_dt = _to_datetime(to_date)

    if from_dt:
        query = query.where("completedAt", ">=", from_dt)
    if to_dt:
        query = query.where("completedAt", "<=", to_dt)

    query = query.order_by("completedAt", direction=firestore.Query.DESCENDING)

    if offset:
        query = query.offset(offset)
    query = query.limit(limit)

    snapshots = query.stream()
    history: List[ActivityHistoryOut] = []
    for snap in snapshots:
        history.append(_snapshot_to_history(snap))

    return history


@router.delete("/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history_entry(
    history_id: str,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    doc_ref = _history_collection(uid).document(history_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Registro de historial no encontrado")
    doc_ref.delete()


@router.get("/favorites", response_model=List[ActivityFavoriteOut])
def list_favorites(
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    query = _favorites_collection(uid).order_by("createdAt", direction=firestore.Query.DESCENDING)
    snapshots = query.stream()
    favorites: List[ActivityFavoriteOut] = []
    for snap in snapshots:
        favorites.append(_snapshot_to_favorite(snap))
    return favorites


@router.post("/favorites", response_model=ActivityFavoriteOut, status_code=status.HTTP_201_CREATED)
def create_favorite(
    payload: ActivityFavoriteCreate,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    collection = _favorites_collection(uid)
    data = payload.model_dump(by_alias=True, exclude_none=True)

    activity_id = data.get("activityId")
    if not activity_id:
        raise HTTPException(status_code=400, detail="El identificador de actividad es obligatorio")

    doc_ref = collection.document(str(activity_id))
    snapshot = doc_ref.get()

    timestamps = {"updatedAt": firestore.SERVER_TIMESTAMP}
    if not snapshot.exists:
        timestamps["createdAt"] = firestore.SERVER_TIMESTAMP

    doc_ref.set({**data, **timestamps}, merge=True)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=500, detail="No se pudo guardar el favorito")
    return _snapshot_to_favorite(snapshot)


@router.delete("/favorites/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_favorite(
    favorite_id: str,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
):
    doc_id = favorite_id.strip()
    if not doc_id:
        raise HTTPException(status_code=400, detail="Identificador inválido")

    doc_ref = _favorites_collection(uid).document(doc_id)
    snapshot = doc_ref.get()
    if not snapshot.exists:
        raise HTTPException(status_code=404, detail="Favorito no encontrado")
    doc_ref.delete()


@router.get("/events/upcoming", response_model=List[ActivityOut])
def list_upcoming_events(
    *,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
    interests: Optional[List[str]] = Query(  # noqa: ARG001 - filtro temporalmente deshabilitado
        None,
        description="Filtra por nombres de intereses; puede repetirse",
    ),
    match_my_interests: bool = Query(  # noqa: ARG001 - filtro temporalmente deshabilitado
        False,
        alias="matchMyInterests",
        description="Si es true, usa los intereses del usuario autenticado",
    ),
    origin: Optional[str] = Query(None),  # noqa: ARG001 - filtro temporalmente deshabilitado
    free_only: bool = Query(False, alias="freeOnly"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    days_ahead: int = Query(
        60,
        ge=1,
        le=365,
        alias="daysAhead",
        description="Cuántos días hacia adelante mostrar",
    ),
):
    now = datetime.now(timezone.utc)
    limit_dt = now + timedelta(days=days_ahead)

    query = _collection().where("type", "==", "event")
    query = query.where("dateTime", ">=", now)
    query = query.where("dateTime", "<=", limit_dt)

    if free_only:
        query = query.where("isFree", "==", True)

    query = query.order_by("dateTime", direction=firestore.Query.ASCENDING)
    query = query.order_by("createdAt", direction=firestore.Query.DESCENDING)

    query = query.limit(limit)
    if offset:
        query = query.offset(offset)

    events: List[ActivityOut] = []
    snapshots = query.stream()
    for snap in snapshots:
        try:
            activity = _snapshot_to_activity(snap)
        except ValidationError as exc:
            logging.getLogger(__name__).warning(
                "list_upcoming_events skipped invalid doc %s: %s", snap.id, exc,
            )
            continue
        if activity.date_time and activity.date_time >= now:
            events.append(activity)
    return events


@router.post("/seed/atemporales", response_model=ActivitiesSeedSummary)
def seed_atemporales(
    *,
    uid: str = Depends(get_current_uid),  # noqa: ARG001 - asegura token válido
    overwrite: bool = Query(True, description="Actualiza entradas existentes si ya hay una coincidente"),
):
    result = seed_atemporal_activities(overwrite=overwrite)
    return result


@router.post("/sync/ics", response_model=ActivitiesSyncSummary)
async def sync_ics(
    *,
    uid: str = Depends(get_current_uid_or_task),  # noqa: ARG001 - acepta token de scheduler o Firebase
    days_ahead: int = Query(60, ge=1, le=180),
    free_only: bool = Query(False),
):
    try:
        result = await sync_ics_events(days_ahead=days_ahead, free_only=free_only)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"ICS sync failed: {exc}") from exc
    return result


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
