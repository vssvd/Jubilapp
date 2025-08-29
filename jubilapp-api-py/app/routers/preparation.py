from fastapi import APIRouter, Depends
from firebase_admin import firestore
from app.firebase import db
from app.security import get_current_uid
from app.schemas_preparation import PreparationOut, PreparationUpdate
from app.domain_preparation import validate_level

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("/preparation", response_model=PreparationOut)
def get_preparation(uid: str = Depends(get_current_uid)):
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return {"preparation_level": None}
    data = doc.to_dict() or {}
    return {"preparation_level": validate_level(data.get("preparation_level"))}

@router.put("/preparation", response_model=PreparationOut)
def update_preparation(payload: PreparationUpdate, uid: str = Depends(get_current_uid)):
    level = validate_level(payload.preparation_level)
    ref = db.collection("users").document(uid)
    ref.set(
        {"preparation_level": level, "updatedAt": firestore.SERVER_TIMESTAMP},
        merge=True,
    )
    return {"preparation_level": level}
