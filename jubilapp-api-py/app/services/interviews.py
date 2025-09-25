from __future__ import annotations

from typing import Any, Dict

from firebase_admin import firestore

from app.firebase import db


def save_turn(uid: str, session_id: str, turn: Dict[str, Any]) -> None:
    ref = db.collection("interviews").document(uid).collection("sessions").document(session_id)
    snapshot = ref.get()
    data = {
        "uid": uid,
        "session_id": session_id,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    if not snapshot.exists:
        data["created_at"] = firestore.SERVER_TIMESTAMP
    ref.set(data, merge=True)

    ref.update({
        "turns": firestore.ArrayUnion([turn]),
    })


def finalize_session(uid: str, session_id: str, summary: Dict[str, Any]) -> None:
    ref = db.collection("interviews").document(uid).collection("sessions").document(session_id)
    ref.set({
        "summary": summary,
        "status": summary.get("status") or "completed",
        "updated_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)
