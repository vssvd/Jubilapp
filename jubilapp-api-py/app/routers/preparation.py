from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from app.firebase import db
from app.security import get_current_uid
from app.schemas_preparation import PreparationOut, PreparationUpdate
from app.domain_preparation import validate_level
from app.domain_mobility import validate_mobility_level

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("/preparation", response_model=PreparationOut)
def get_preparation(uid: str = Depends(get_current_uid)):
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return {"preparation_level": None, "mobility_level": None}
    data = doc.to_dict() or {}
    try:
        level = validate_level(data.get("preparation_level"))
    except ValueError:
        level = None
    try:
        mobility = validate_mobility_level(data.get("mobility_level"))
    except ValueError:
        mobility = None

    return {"preparation_level": level, "mobility_level": mobility}

@router.put("/preparation", response_model=PreparationOut)
def update_preparation(payload: PreparationUpdate, uid: str = Depends(get_current_uid)):
    try:
        level = validate_level(payload.preparation_level)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        mobility = validate_mobility_level(payload.mobility_level)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if level is None and mobility is None:
        raise HTTPException(status_code=400, detail="No hay cambios para guardar")

    ref = db.collection("users").document(uid)
    update_data = {"updatedAt": firestore.SERVER_TIMESTAMP}
    if level is not None:
        update_data["preparation_level"] = level
    if mobility is not None:
        update_data["mobility_level"] = mobility

    ref.set(update_data, merge=True)

    doc = ref.get()
    data = doc.to_dict() or {}
    try:
        current_level = validate_level(data.get("preparation_level"))
    except ValueError:
        current_level = None
    try:
        current_mobility = validate_mobility_level(data.get("mobility_level"))
    except ValueError:
        current_mobility = None

    return {"preparation_level": current_level, "mobility_level": current_mobility}
