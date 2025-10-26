from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable

from firebase_admin import firestore

from app.firebase import db
from app.domain_activities import ATEMPORAL_ACTIVITIES, get_category_for_activity


@dataclass
class SeedResult:
    created: int = 0
    updated: int = 0
    skipped: int = 0

    @property
    def total(self) -> int:
        return self.created + self.updated

    def as_dict(self) -> Dict[str, int]:
        return {
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "total": self.total,
        }


def _build_atemporal_payload() -> Iterable[Dict]:
    base_link = "https://app.jubilapp.cl/ideas/atemporales"

    for item in ATEMPORAL_ACTIVITIES:
        item_id = item.get("id")
        if not item_id:
            continue

        doc_id = f"atemporal-{item_id}"
        link = f"{base_link}/{doc_id}"
        tags = item.get("tags") or []
        category = get_category_for_activity(item)

        payload = {
            "doc_id": doc_id,
            "type": "atemporal",
            "title": item.get("title"),
            "category": category,
            "dateTime": None,
            "location": None,
            "link": item.get("link") or link,
            "origin": item.get("origin") or "catalogo-interno",
            "emoji": item.get("emoji"),
            "tags": tags,
            "indoor": item.get("indoor"),
            "energy": item.get("energy"),
            "duration_min": item.get("duration_min"),
            "cost": item.get("cost"),
            "time_of_day": item.get("time_of_day"),
            "suggested_time": item.get("suggested_time"),
            "source": {
                "type": "domain_activities",
                "id": item_id,
            },
        }

        yield payload


def seed_atemporal_activities(*, overwrite: bool = True) -> Dict[str, int]:
    """Sincroniza el catálogo atemporal interno en la colección activities."""

    collection = db.collection("activities")
    summary = SeedResult()

    for record in _build_atemporal_payload():
        doc_id = record.pop("doc_id")
        doc_ref = collection.document(doc_id)
        snapshot = doc_ref.get()

        data = {
            key: value for key, value in record.items() if value is not None
        }

        timestamps = {"updatedAt": firestore.SERVER_TIMESTAMP}

        if not snapshot.exists:
            timestamps["createdAt"] = firestore.SERVER_TIMESTAMP
            doc_ref.set({**data, **timestamps}, merge=True)
            summary.created += 1
            continue

        if not overwrite:
            summary.skipped += 1
            continue

        doc_ref.set({**data, **timestamps}, merge=True)
        summary.updated += 1

    return summary.as_dict()


if __name__ == "__main__":  # pragma: no cover - utilidad manual
    result = seed_atemporal_activities()
    print(f"Atemporal activities synced: {result}")
