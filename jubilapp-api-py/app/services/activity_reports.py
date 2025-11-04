from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from firebase_admin import firestore

from app.domain_activities import ATEMPORAL_ACTIVITIES, get_category_for_activity

from app.firebase import db


def _clean_activity_type(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = value.strip().lower()
    return cleaned or None


def _clean_activity_id(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return str(int(value)) if isinstance(value, int) else str(value)
    cleaned = str(value).strip()
    return cleaned or None


def _clean_text(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None


def _token(activity_type: str, activity_id: str) -> str:
    return f"{activity_type}::{activity_id}"


def _user_doc(uid: str):
    return db.collection("users").document(uid)


def _parse_entry(token: str, payload: Dict) -> Tuple[Optional[str], Optional[str], Dict]:
    activity_type = _clean_activity_type(payload.get("activityType") or payload.get("activity_type"))
    activity_id = _clean_activity_id(payload.get("activityId") or payload.get("activity_id"))

    if activity_type is None and "::" in token:
        activity_type = _clean_activity_type(token.split("::", 1)[0])
    if activity_id is None and "::" in token:
        activity_id = _clean_activity_id(token.split("::", 1)[1])

    return activity_type, activity_id, payload


def _atemporal_metadata(activity_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    try:
        numeric_id = int(activity_id)
    except (TypeError, ValueError):
        return None, None, None
    for row in ATEMPORAL_ACTIVITIES:
        try:
            row_id = int(row.get("id"))
        except (TypeError, ValueError):
            continue
        if row_id == numeric_id:
            title = _clean_text(row.get("title"))
            emoji = _clean_text(row.get("emoji"))
            category_value = get_category_for_activity(row)
            category = _clean_text(category_value)
            return title, emoji, category
    return None, None, None


@dataclass
class ActivityReportResult:
    id: str
    activity_type: str
    activity_id: str
    reason: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    title: Optional[str]
    emoji: Optional[str]
    category: Optional[str]


def _to_datetime(value: Optional[object]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if hasattr(value, "to_datetime"):
        dt = value.to_datetime()
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None


def _reports_map(uid: str) -> Dict[str, Dict]:
    try:
        snapshot = _user_doc(uid).get()
    except Exception as exc:  # pragma: no cover - Firestore I/O
        raise RuntimeError(f"Firestore get failed: {exc}") from exc
    data = snapshot.to_dict() or {}
    reports = data.get("activity_reports")
    return reports if isinstance(reports, dict) else {}


def list_reports(uid: str, *, activity_type: Optional[str] = None) -> List[ActivityReportResult]:
    cleaned_type = _clean_activity_type(activity_type) if activity_type else None
    reports = _reports_map(uid)

    results: List[ActivityReportResult] = []
    for token, payload in reports.items():
        if not isinstance(payload, dict):
            continue
        parsed_type, parsed_id, data = _parse_entry(token, payload)
        if not parsed_type or not parsed_id:
            continue
        if cleaned_type and parsed_type != cleaned_type:
            continue
        reason = _clean_text(data.get("reason"))
        title = _clean_text(data.get("title"))
        emoji = _clean_text(data.get("emoji"))
        category = _clean_text(data.get("category"))
        if parsed_type == "atemporal":
            fallback_title, fallback_emoji, fallback_category = _atemporal_metadata(parsed_id)
            if title is None:
                title = fallback_title
            if emoji is None:
                emoji = fallback_emoji
            if category is None:
                category = fallback_category
        results.append(
            ActivityReportResult(
                id=token,
                activity_type=parsed_type,
                activity_id=parsed_id,
                reason=reason,
                title=title,
                emoji=emoji,
                category=category,
                created_at=_to_datetime(data.get("createdAt") or data.get("created_at")),
                updated_at=_to_datetime(data.get("updatedAt") or data.get("updated_at")),
            )
        )
    return results


def report_activity(
    uid: str,
    *,
    activity_type: str,
    activity_id: str,
    reason: Optional[str] = None,
    title: Optional[str] = None,
    emoji: Optional[str] = None,
    category: Optional[str] = None,
) -> ActivityReportResult:
    atype = _clean_activity_type(activity_type)
    aid = _clean_activity_id(activity_id)
    if atype is None:
        raise ValueError("Tipo de actividad inválido")
    if aid is None:
        raise ValueError("Identificador de actividad inválido")

    token = _token(atype, aid)
    reports = _reports_map(uid)
    existing = reports.get(token) if isinstance(reports, dict) else None
    cleaned_reason = _clean_text(reason)
    cleaned_title = _clean_text(title)
    cleaned_emoji = _clean_text(emoji)
    cleaned_category = _clean_text(category)
    if atype == "atemporal":
        fallback_title, fallback_emoji, fallback_category = _atemporal_metadata(aid)
        if cleaned_title is None:
            cleaned_title = fallback_title
        if cleaned_emoji is None:
            cleaned_emoji = fallback_emoji
        if cleaned_category is None:
            cleaned_category = fallback_category

    created_at_existing = _to_datetime(existing.get("createdAt")) if isinstance(existing, dict) else None
    now = datetime.now(timezone.utc)

    write_entry: Dict[str, object] = {
        "activityType": atype,
        "activityId": aid,
        "reason": cleaned_reason,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if created_at_existing is not None:
        write_entry["createdAt"] = created_at_existing
    else:
        write_entry["createdAt"] = firestore.SERVER_TIMESTAMP
    if cleaned_title is not None:
        write_entry["title"] = cleaned_title
    if cleaned_emoji is not None:
        write_entry["emoji"] = cleaned_emoji
    if cleaned_category is not None:
        write_entry["category"] = cleaned_category

    try:
        _user_doc(uid).set({"activity_reports": {token: write_entry}}, merge=True)
    except Exception as exc:  # pragma: no cover - Firestore I/O
        raise RuntimeError(f"Firestore write failed: {exc}") from exc

    result_created = created_at_existing or now
    return ActivityReportResult(
        id=token,
        activity_type=atype,
        activity_id=aid,
        reason=cleaned_reason,
        title=cleaned_title,
        emoji=cleaned_emoji,
        category=cleaned_category,
        created_at=result_created,
        updated_at=now,
    )


def delete_report(uid: str, *, activity_type: str, activity_id: str) -> None:
    atype = _clean_activity_type(activity_type)
    aid = _clean_activity_id(activity_id)
    if atype is None or aid is None:
        return
    token = _token(atype, aid)
    try:
        _user_doc(uid).update({f"activity_reports.{token}": firestore.DELETE_FIELD})
    except Exception:
        # Si no existe el doc o el campo, lo ignoramos.
        return


def reported_tokens(uid: str) -> Set[str]:
    reports = _reports_map(uid)
    tokens: Set[str] = set()
    for token, payload in reports.items():
        if not isinstance(payload, dict):
            continue
        parsed_type, parsed_id, _ = _parse_entry(token, payload)
        if parsed_type and parsed_id:
            tokens.add(_token(parsed_type, parsed_id))
    return tokens


def reported_atemporal_ids(uid: str) -> Set[int]:
    reports = _reports_map(uid)
    ids: Set[int] = set()
    for token, payload in reports.items():
        if not isinstance(payload, dict):
            continue
        parsed_type, parsed_id, _ = _parse_entry(token, payload)
        if parsed_type != "atemporal" or parsed_id is None:
            continue
        try:
            ids.add(int(parsed_id))
        except (TypeError, ValueError):
            continue
    return ids


def should_exclude(token_set: Set[str], activity_type: Optional[str], activity_id: Optional[str]) -> bool:
    if not activity_type or not activity_id:
        return False
    atype = _clean_activity_type(activity_type)
    aid = _clean_activity_id(activity_id)
    if atype is None or aid is None:
        return False
    return _token(atype, aid) in token_set
