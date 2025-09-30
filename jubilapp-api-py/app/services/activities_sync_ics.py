from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

from firebase_admin import firestore

from app.firebase import db
from app.schemas_events import EventItem
from app.services.events_ics import fetch_ics_all


@dataclass
class SyncSummary:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    deleted: int = 0
    errors: int = 0

    def as_dict(self) -> Dict[str, int]:
        return {
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "deleted": self.deleted,
            "errors": self.errors,
            "total": self.created + self.updated,
        }


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _doc_id(event_id: str) -> str:
    return event_id.replace(":", "-")


def _source_feed_from_id(event_id: str) -> Optional[str]:
    parts = event_id.split(":", 2)
    return parts[1] if len(parts) > 1 else None


KEYWORD_INTERESTS: List[tuple[str, str]] = [
    ("yoga", "Gimnasia suave / yoga / pilates"),
    ("pilates", "Gimnasia suave / yoga / pilates"),
    ("camin", "Caminatas / trekking"),
    ("trek", "Caminatas / trekking"),
    ("museo", "Museos, teatro, cine"),
    ("teatro", "Museos, teatro, cine"),
    ("cine", "Museos, teatro, cine"),
    ("concierto", "Música (escuchar, cantar, tocar instrumento)"),
    ("musica", "Música (escuchar, cantar, tocar instrumento)"),
    ("baile", "Baile"),
    ("danza", "Baile"),
    ("gastr", "Gastronomía (recetas, restaurantes)"),
    ("feria", "Eventos culturales y ferias"),
    ("expos", "Eventos culturales y ferias"),
    ("volunt", "Voluntariado"),
    ("salud", "Control de salud / chequeos"),
    ("medit", "Meditación / mindfulness"),
]

FEED_DEFAULT_INTERESTS = {
    "jubilapp eventos": ["Eventos culturales y ferias"],
}


def _event_interest_tags(event: EventItem) -> Optional[List[str]]:
    haystack_parts: List[str] = []
    if event.title:
        haystack_parts.append(event.title)
    if event.description:
        haystack_parts.append(event.description)
    if event.venue:
        if event.venue.name:
            haystack_parts.append(event.venue.name)
        if event.venue.address:
            haystack_parts.append(event.venue.address)

    haystack = " ".join(haystack_parts).lower()
    tags: List[str] = []
    for keyword, interest in KEYWORD_INTERESTS:
        if keyword in haystack and interest not in tags:
            tags.append(interest)
        if len(tags) >= 3:
            break

    if not tags:
        feed = (_source_feed_from_id(event.id) or "").lower()
        defaults = FEED_DEFAULT_INTERESTS.get(feed)
        if defaults:
            tags.extend(defaults[:3])

    return tags or None


def _event_payload(event: EventItem) -> Dict[str, object]:
    start_dt = _parse_datetime(event.start_utc)
    if start_dt is None:
        raise ValueError("Evento sin fecha válida")

    payload: Dict[str, object] = {
        "type": "event",
        "title": event.title,
        "category": None,
        "dateTime": start_dt,
        "location": event.venue.address if event.venue and event.venue.address else event.venue.name if event.venue else None,
        "link": event.url,
        "origin": "ics",
        "description": event.description,
        "isFree": event.is_free,
        "currency": event.currency,
        "minPrice": event.min_price,
        "image": event.image,
        "source": {
            "type": "ics",
            "id": event.id,
            "feed": _source_feed_from_id(event.id),
        },
    }

    if event.venue:
        payload["venue"] = {
            "name": event.venue.name,
            "address": event.venue.address,
            "lat": event.venue.lat,
            "lng": event.venue.lng,
        }

    tags = _event_interest_tags(event)
    if tags:
        payload["tags"] = tags

    return {key: value for key, value in payload.items() if value is not None}


async def sync_ics_events(*, days_ahead: int = 60, free_only: bool = False) -> Dict[str, int]:
    events = await fetch_ics_all(days_ahead=days_ahead, free_only=free_only)

    collection = db.collection("activities")
    summary = SyncSummary()
    processed_ids = set()

    for event in events:
        try:
            payload = _event_payload(event)
        except ValueError:
            summary.skipped += 1
            continue
        except Exception:
            summary.errors += 1
            continue

        doc_id = _doc_id(event.id)
        processed_ids.add(doc_id)

        doc_ref = collection.document(doc_id)
        snapshot = doc_ref.get()

        timestamps = {"updatedAt": firestore.SERVER_TIMESTAMP}
        if not snapshot.exists:
            timestamps["createdAt"] = firestore.SERVER_TIMESTAMP
            doc_ref.set({**payload, **timestamps})
            summary.created += 1
        else:
            doc_ref.set({**payload, **timestamps}, merge=True)
            summary.updated += 1

    existing_ids = {doc.id for doc in collection.where("origin", "==", "ics").stream()}
    for stale_id in existing_ids - processed_ids:
        collection.document(stale_id).delete()
        summary.deleted += 1

    return summary.as_dict()
