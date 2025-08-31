from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from app.firebase import db
from app.security import get_current_uid
from app.schemas_profile import ProfileOut, ProfileUpdate


router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut)
def get_profile(uid: str = Depends(get_current_uid)):
    doc = db.collection("users").document(uid).get()
    data = doc.to_dict() or {}
    return ProfileOut(
        email=data.get("email"),
        full_name=(data.get("full_name") or None),
        description=(data.get("description") or None),
        photo_url=(data.get("photo_url") or None),
        location_city=(data.get("location_city") or None),
        location_region=(data.get("location_region") or None),
        location_lat=(data.get("location_lat") or None),
        location_lng=(data.get("location_lng") or None),
    )


@router.put("", response_model=ProfileOut)
def update_profile(payload: ProfileUpdate, uid: str = Depends(get_current_uid)):
    ref = db.collection("users").document(uid)

    update_data: dict = {"updatedAt": firestore.SERVER_TIMESTAMP}

    if payload.full_name is not None:
        name = (payload.full_name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        update_data["full_name"] = name

    if payload.description is not None:
        # Permitimos limpiar descripción con vacío → None
        desc = (payload.description or "").strip()
        update_data["description"] = desc or None

    if payload.photo_url is not None:
        # Validación básica de longitud; formato lo dejamos al cliente
        url = (payload.photo_url or "").strip()
        if not url:
            # borrar foto si llega vacío deliberadamente
            update_data["photo_url"] = None
        else:
            update_data["photo_url"] = url

    # Ubicación: ciudad/ región y/o coordenadas
    if payload.location_city is not None:
        city = (payload.location_city or "").strip()
        update_data["location_city"] = city or None
    if payload.location_region is not None:
        region = (payload.location_region or "").strip()
        update_data["location_region"] = region or None
    if payload.location_lat is not None:
        lat = float(payload.location_lat)
        if not (-90.0 <= lat <= 90.0):
            raise HTTPException(status_code=400, detail="lat fuera de rango")
        update_data["location_lat"] = lat
    if payload.location_lng is not None:
        lng = float(payload.location_lng)
        if not (-180.0 <= lng <= 180.0):
            raise HTTPException(status_code=400, detail="lng fuera de rango")
        update_data["location_lng"] = lng
    # si viene cualquier dato de ubicación, refresca marca específica
    if any(k.startswith("location_") for k in update_data.keys()):
        update_data["location_updated_at"] = firestore.SERVER_TIMESTAMP

    if len(update_data.keys()) <= 1:  # solo updatedAt
        raise HTTPException(status_code=400, detail="Ningún campo para actualizar")

    ref.set(update_data, merge=True)

    # devolver datos actuales
    doc = ref.get()
    data = doc.to_dict() or {}
    return ProfileOut(
        email=data.get("email"),
        full_name=(data.get("full_name") or None),
        description=(data.get("description") or None),
        photo_url=(data.get("photo_url") or None),
        location_city=(data.get("location_city") or None),
        location_region=(data.get("location_region") or None),
        location_lat=(data.get("location_lat") or None),
        location_lng=(data.get("location_lng") or None),
    )
