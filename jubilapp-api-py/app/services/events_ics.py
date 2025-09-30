from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Dict, List, Optional

import httpx
from dateutil import tz
from ics import Calendar

from app.providers.ics_feeds import FEEDS
from app.schemas_events import EventItem, EventsResponse, Venue
from app.services.geocoding import geocode_text

FREE_PATTERNS = [
    "gratis",
    "gratuito",
    "entrada liberada",
    "liberada",
    "sin costo",
    "libre",
    "$0",
    "0 clp",
]

_CACHE: Dict[str, Dict[str, object]] = {}
_CACHE_TTL_SECONDS = 900


class ICSProviderError(RuntimeError):
    """Raised when the ICS feeds cannot be fetched or parsed."""


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    value = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * radius * asin(sqrt(value))


def _looks_free(*chunks: Optional[str]) -> bool:
    blob = " ".join([chunk or "" for chunk in chunks]).lower()
    return any(pattern in blob for pattern in FREE_PATTERNS)


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=tz.tzlocal()).astimezone(timezone.utc)
    return dt.astimezone(timezone.utc)


def _cache_get(feed_url: str) -> Optional[List[EventItem]]:
    cached = _CACHE.get(feed_url)
    if not cached:
        return None
    stored_at = cached.get("at")
    if not isinstance(stored_at, datetime):
        return None
    if (datetime.now(timezone.utc) - stored_at).total_seconds() > _CACHE_TTL_SECONDS:
        return None
    events = cached.get("events")
    return events if isinstance(events, list) else None


def _cache_set(feed_url: str, events: List[EventItem]) -> None:
    _CACHE[feed_url] = {"at": datetime.now(timezone.utc), "events": events}


def _make_id(feed_name: str, start_iso: str, title: str) -> str:
    normalized_title = title[:40].replace(":", " ").strip() or "evento"
    return f"ics:{feed_name}:{start_iso}:{normalized_title}"


def _parse_event_start(event: EventItem) -> Optional[datetime]:
    if not event.start_utc:
        return None
    try:
        return datetime.fromisoformat(event.start_utc.replace("Z", "+00:00"))
    except ValueError:
        return None


def _to_float(value: Optional[object]) -> Optional[float]:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


async def _parse_event(
    feed: Dict[str, object],
    raw_event,
) -> Optional[EventItem]:
    start = _ensure_utc(getattr(getattr(raw_event, "begin", None), "datetime", None))
    if not start:
        return None

    end = _ensure_utc(getattr(getattr(raw_event, "end", None), "datetime", None))

    name = getattr(raw_event, "name", None) or "Evento"
    title = name.strip() if isinstance(name, str) else "Evento"

    description_raw = getattr(raw_event, "description", None)
    description = description_raw.strip() if isinstance(description_raw, str) else ""
    location_text_raw = getattr(raw_event, "location", None)
    location_text = location_text_raw.strip() if isinstance(location_text_raw, str) else ""

    fallback_lat = _to_float(feed.get("lat"))
    fallback_lng = _to_float(feed.get("lng"))
    vlat = fallback_lat
    vlng = fallback_lng

    feed_city_raw = feed.get("city")
    feed_city = feed_city_raw.strip() if isinstance(feed_city_raw, str) and feed_city_raw.strip() else None

    geo = getattr(raw_event, "geo", None)
    geo_lat = _to_float(getattr(geo, "latitude", None))
    geo_lng = _to_float(getattr(geo, "longitude", None))
    if geo_lat is not None and geo_lng is not None:
        vlat, vlng = geo_lat, geo_lng
    elif location_text:
        queries = [location_text]
        if feed_city and feed_city.lower() not in location_text.lower():
            queries.append(f"{location_text}, {feed_city}")

        for query_text in queries:
            coords = await geocode_text(query_text)
            if coords:
                vlat, vlng = coords
                break

    if vlat is None or vlng is None:
        vlat = fallback_lat
        vlng = fallback_lng

    event_url = getattr(raw_event, "url", None)
    if event_url is None and hasattr(raw_event, "extra"):
        event_url = raw_event.extra.get("URL") if isinstance(raw_event.extra, dict) else None

    url = str(event_url).strip() if event_url else ""

    item = EventItem(
        id=_make_id(str(feed.get("name", "feed")), start.isoformat(), title),
        title=title or "Evento",
        description=description or None,
        start_utc=start.isoformat(),
        end_utc=end.isoformat() if end else None,
        url=url,
        currency="CLP",
        min_price=None,
        is_free=_looks_free(title, description, location_text),
        image=None,
        venue=Venue(
            name=str(feed.get("name")) if feed.get("name") else None,
            address=location_text or feed_city,
            lat=vlat,
            lng=vlng,
        ),
        source="ics",
    )
    return item


async def _fetch_feed(client: httpx.AsyncClient, feed: Dict[str, object]) -> List[EventItem]:
    feed_url = str(feed.get("url") or "").strip()
    if not feed_url:
        return []

    cached_events = _cache_get(feed_url)
    if cached_events is not None:
        return cached_events

    try:
        response = await client.get(feed_url, timeout=20.0)
    except httpx.HTTPError as exc:
        raise ICSProviderError(f"No se pudo acceder al feed ICS {feed_url}: {exc}") from exc

    if response.status_code != 200:
        raise ICSProviderError(f"Feed ICS {feed_url} devolvio {response.status_code}")

    try:
        calendar = Calendar(response.text)
    except Exception as exc:  # noqa: BLE001 - libreria externa puede lanzar varios errores
        raise ICSProviderError(f"Feed ICS {feed_url} tiene formato invalido") from exc

    events: List[EventItem] = []
    for raw_event in getattr(calendar, "events", []):
        item = await _parse_event(feed, raw_event)
        if item:
            events.append(item)

    _cache_set(feed_url, events)
    return events


async def fetch_ics_nearby(
    *,
    lat: float,
    lng: float,
    radius_km: float,
    query: Optional[str] = None,
    free_only: bool = False,
    days_ahead: int = 60,
) -> EventsResponse:
    if not FEEDS:
        return EventsResponse(total=0, items=[])

    now_utc = datetime.now(timezone.utc)
    limit_utc = now_utc + timedelta(days=days_ahead)

    items: List[EventItem] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for feed in FEEDS:
            try:
                feed_events = await _fetch_feed(client, feed)
            except ICSProviderError:
                continue

            for event in feed_events:
                try:
                    start = datetime.fromisoformat(event.start_utc.replace("Z", "+00:00"))
                except ValueError:
                    # Si el formato es raro, omitimos el evento
                    continue

                if start < now_utc or start > limit_utc:
                    continue

                venue = event.venue
                vlat = venue.lat if venue else None
                vlng = venue.lng if venue else None
                if vlat is None or vlng is None:
                    vlat = feed.get("lat")
                    vlng = feed.get("lng")
                try:
                    vlat_f = float(vlat) if vlat is not None else None
                    vlng_f = float(vlng) if vlng is not None else None
                except (TypeError, ValueError):
                    vlat_f = None
                    vlng_f = None

                if vlat_f is not None and vlng_f is not None:
                    if _haversine_km(lat, lng, vlat_f, vlng_f) > radius_km:
                        continue

                if query:
                    haystack = f"{event.title} {event.venue.address if event.venue else ''}".lower()
                    if query.lower() not in haystack:
                        continue

                if free_only and not event.is_free:
                    continue

                items.append(event)

    items.sort(key=lambda item: item.start_utc)
    return EventsResponse(total=len(items), items=items)


async def fetch_ics_all(
    *,
    days_ahead: int = 60,
    free_only: bool = False,
    query: Optional[str] = None,
) -> List[EventItem]:
    """Fetch events from all configured ICS feeds without location filtering."""

    if not FEEDS:
        return []

    now_utc = datetime.now(timezone.utc)
    limit_utc = now_utc + timedelta(days=days_ahead)

    items: List[EventItem] = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for feed in FEEDS:
            try:
                feed_events = await _fetch_feed(client, feed)
            except ICSProviderError:
                continue

            for event in feed_events:
                start = _parse_event_start(event)
                if not start or start < now_utc or start > limit_utc:
                    continue

                if query:
                    haystack = f"{event.title} {event.venue.address if event.venue else ''}".lower()
                    if query.lower() not in haystack:
                        continue

                if free_only and not event.is_free:
                    continue

                items.append(event)

    items.sort(key=lambda item: item.start_utc)
    return items
