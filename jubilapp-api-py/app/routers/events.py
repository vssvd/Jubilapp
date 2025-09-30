from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas_events import EventsResponse
from app.services.events_ics import ICSProviderError, fetch_ics_nearby


def _default_radius() -> float:
    raw = os.getenv("EVENTS_DEFAULT_RADIUS_KM")
    if not raw:
        return 20.0
    try:
        parsed = float(raw)
    except ValueError:
        return 20.0
    return max(1.0, min(parsed, 200.0))


DEFAULT_RADIUS_KM = _default_radius()

router = APIRouter(prefix="/events", tags=["Events"])


@router.get("/nearby", response_model=EventsResponse)
async def events_nearby(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(DEFAULT_RADIUS_KM, ge=1.0, le=200.0),
    q: Optional[str] = Query(None, min_length=1, max_length=200),
    free_only: bool = Query(False, description="Filtra eventos detectados como gratuitos"),
    days_ahead: int = Query(60, ge=1, le=365, description="Cuantos dias hacia adelante buscar"),
):
    try:
        return await fetch_ics_nearby(
            lat=lat,
            lng=lng,
            radius_km=radius_km,
            query=q,
            free_only=free_only,
            days_ahead=days_ahead,
        )
    except ICSProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - fallback para errores no esperados
        raise HTTPException(status_code=500, detail="ICS driver failure") from exc
