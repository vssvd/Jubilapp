from __future__ import annotations

from typing import Dict, List

from app.firebase import db


def get_user_interest_names(uid: str) -> List[str]:
    """Return the list of interest names stored for the given user.

    Falls back to resolving interest IDs against the interests_catalog
    when the `interests` array is empty but `interest_ids` is present.
    """

    doc = db.collection("users").document(uid).get()
    data = doc.to_dict() or {}

    names: List[str] = []
    for item in data.get("interests") or []:
        if isinstance(item, str):
            cleaned = item.strip()
            if cleaned and cleaned not in names:
                names.append(cleaned)

    if names:
        return names

    ids: List[int] = []
    for raw in data.get("interest_ids") or []:
        if isinstance(raw, int):
            ids.append(raw)
        elif isinstance(raw, str) and raw.isdigit():
            ids.append(int(raw))

    if not ids:
        return []

    catalog: Dict[int, str] = {}
    for row in db.collection("interests_catalog").stream():
        payload = row.to_dict() or {}
        try:
            raw_id = payload.get("id")
            row_id = int(raw_id if raw_id is not None else row.id)
        except (TypeError, ValueError):
            continue

        name = payload.get("name")
        if isinstance(name, str):
            cleaned = name.strip()
            if cleaned:
                catalog[row_id] = cleaned

    resolved: List[str] = []
    for iid in ids:
        name = catalog.get(iid)
        if name and name not in resolved:
            resolved.append(name)

    return resolved

