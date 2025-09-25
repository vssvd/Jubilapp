from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.schemas_interests import (
    InterestOut,
    UserInterestsIn,
    UserInterestsOut,
    UserInterestsByNamesIn,
)
from app.security import verify_firebase_token
from app.firebase import db as fs
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from app.services.interests_catalog import load_catalog, ensure_catalog_firestore


router = APIRouter(prefix="/interests", tags=["Interests"])

@router.get("/catalog", response_model=List[InterestOut])
def get_catalog():
    # Auto-seed en Firestore
    ensure_catalog_firestore()
    return load_catalog()

@router.get("/me", response_model=UserInterestsOut)
def get_my_interests(decoded: dict = Depends(verify_firebase_token)):
    # Lee IDs desde Firestore y resuelve contra catálogo
    user_doc = fs.collection("users").document(decoded["uid"]).get()
    data = user_doc.to_dict() or {}
    ids = list(sorted(set(int(i) for i in (data.get("interest_ids") or []))))
    if not ids:
        return {"interests": []}
    catalog = {c["id"]: c for c in load_catalog()}
    rows = [catalog[i] for i in ids if i in catalog]
    return {"interests": rows}

@router.put("/me", response_model=UserInterestsOut)
def set_my_interests(
    payload: UserInterestsIn,
    decoded: dict = Depends(verify_firebase_token),
):
    try:
        # validar ids (sin duplicados)
        ids = sorted(set(int(i) for i in payload.interest_ids))
        if not ids:
            fs.collection("users").document(decoded["uid"]).set(
                {"interest_ids": [], "interests": [], "interests_updated_at": SERVER_TIMESTAMP, "updatedAt": SERVER_TIMESTAMP},
                merge=True,
            )
            return {"interests": []}

        # Validar contra catálogo Firestore
        catalog = {c["id"]: c for c in load_catalog()}
        if any(i not in catalog for i in ids):
            raise HTTPException(status_code=400, detail="Algunos intereses no existen")

        rows = [catalog[i] for i in ids]

        # Persistir en Firestore
        fs.collection("users").document(decoded["uid"]).set(
            {
                "interest_ids": ids,
                "interests": [r["name"] for r in rows],
                "interests_updated_at": SERVER_TIMESTAMP,
                "updatedAt": SERVER_TIMESTAMP,
            },
            merge=True,
        )

        return {"interests": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando intereses: {e}")

@router.put("/me/by-names", response_model=UserInterestsOut)
def set_my_interests_by_names(
    payload: UserInterestsByNamesIn,
    decoded: dict = Depends(verify_firebase_token),
):
    try:
        # normaliza y quita duplicados
        names = sorted(set(n.strip() for n in payload.interest_names if n and n.strip()))
        if not names:
            fs.collection("users").document(decoded["uid"]).set(
                {"interest_ids": [], "interests": [], "interests_updated_at": SERVER_TIMESTAMP, "updatedAt": SERVER_TIMESTAMP},
                merge=True,
            )
            return {"interests": []}

        # Garantiza catálogo base en Firestore
        ensure_catalog_firestore()

        # Cargar catálogo actual
        catalog_list = load_catalog()
        by_name = {c["name"]: c for c in catalog_list}

        # Crear cualquier nombre faltante con categoría nula
        missing = [n for n in names if n not in by_name]
        if missing:
            col = fs.collection("interests_catalog")
            # calcular next_id
            current_ids = [c["id"] for c in catalog_list]
            next_id = (max(current_ids) + 1) if current_ids else 1
            batch = fs.batch()
            for n in missing:
                doc_ref = col.document(str(next_id))
                batch.set(doc_ref, {"id": next_id, "name": n, "category": None})
                next_id += 1
            batch.commit()
            # recargar
            catalog_list = load_catalog()
            by_name = {c["name"]: c for c in catalog_list}

        ids = sorted({by_name[n]["id"] for n in names if n in by_name})
        rows = [by_name[n] for n in names if n in by_name]

        # Persistir en Firestore
        fs.collection("users").document(decoded["uid"]).set(
            {
                "interest_ids": ids,
                "interests": [r["name"] for r in rows],
                "interests_updated_at": SERVER_TIMESTAMP,
                "updatedAt": SERVER_TIMESTAMP,
            },
            merge=True,
        )

        return {"interests": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando intereses por nombre: {e}")
