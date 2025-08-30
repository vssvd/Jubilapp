from fastapi import APIRouter, Depends, HTTPException
from typing import List, Tuple, Dict
from app.schemas_interests import (
    InterestOut,
    UserInterestsIn,
    UserInterestsOut,
    UserInterestsByNamesIn,
)
from app.security import verify_firebase_token
from app.firebase import db as fs
from google.cloud.firestore_v1 import SERVER_TIMESTAMP


router = APIRouter(prefix="/interests", tags=["Interests"])

# Catálogo base usado por la app. Si la base de datos aún no lo contiene,
# lo insertamos automáticamente la primera vez que se solicita el catálogo.
BASE_CATALOG: List[Tuple[str, str]] = [
    # 1. Creatividad y Arte
    ("Creatividad y Arte", "Pintura / Dibujo"),
    ("Creatividad y Arte", "Manualidades (tejido, carpintería, cerámica)"),
    ("Creatividad y Arte", "Música (escuchar, cantar, tocar instrumento)"),
    ("Creatividad y Arte", "Fotografía"),
    ("Creatividad y Arte", "Escritura / lectura creativa"),
    # 2. Deporte y Bienestar
    ("Deporte y Bienestar", "Caminatas / trekking"),
    ("Deporte y Bienestar", "Gimnasia suave / yoga / pilates"),
    ("Deporte y Bienestar", "Natación"),
    ("Deporte y Bienestar", "Baile"),
    ("Deporte y Bienestar", "Ciclismo"),
    ("Deporte y Bienestar", "Pesca"),
    ("Deporte y Bienestar", "Jardinería"),
    # 3. Aprendizaje y Desarrollo Personal
    ("Aprendizaje y Desarrollo Personal", "Idiomas"),
    ("Aprendizaje y Desarrollo Personal", "Historia y cultura"),
    ("Aprendizaje y Desarrollo Personal", "Tecnología (apps, redes sociales)"),
    ("Aprendizaje y Desarrollo Personal", "Cursos online / talleres"),
    ("Aprendizaje y Desarrollo Personal", "Club de lectura"),
    # 4. Social y Comunitario
    ("Social y Comunitario", "Voluntariado"),
    ("Social y Comunitario", "Clubes sociales / centros de adulto mayor"),
    ("Social y Comunitario", "Actividades religiosas o espirituales"),
    ("Social y Comunitario", "Juegos de mesa / cartas"),
    ("Social y Comunitario", "Actividades con nietos / familia"),
    # 5. Salud y Cuidado Personal
    ("Salud y Cuidado Personal", "Meditación / mindfulness"),
    ("Salud y Cuidado Personal", "Cocina saludable"),
    ("Salud y Cuidado Personal", "Autocuidado (skincare, spa casero, etc.)"),
    ("Salud y Cuidado Personal", "Control de salud / chequeos"),
    # 6. Ocio y Cultura
    ("Ocio y Cultura", "Viajes y turismo local"),
    ("Ocio y Cultura", "Museos, teatro, cine"),
    ("Ocio y Cultura", "Gastronomía (recetas, restaurantes)"),
    ("Ocio y Cultura", "Eventos culturales y ferias"),
    # 7. Tecnología y Digital
    ("Tecnología y Digital", "Redes sociales"),
    ("Tecnología y Digital", "Videollamadas con familia / amigos"),
    ("Tecnología y Digital", "Juegos digitales (apps, consolas, PC)"),
    ("Tecnología y Digital", "Fotografía y edición digital"),
    ("Tecnología y Digital", "Apps de finanzas, salud, transporte"),
]

def _load_catalog() -> List[Dict]:
    """Carga el catálogo completo desde Firestore como lista de dicts con keys id,name,category."""
    docs = list(fs.collection("interests_catalog").stream())
    out = []
    for d in docs:
        data = d.to_dict() or {}
        # Asegura tipos esperados
        iid = int(data.get("id") or (d.id if d.id.isdigit() else 0))
        out.append({
            "id": iid,
            "name": data.get("name") or "",
            "category": data.get("category"),
        })
    # Orden estable
    out.sort(key=lambda r: (r.get("category") or "", r.get("name") or ""))
    return out


def _ensure_catalog_firestore() -> None:
    """Inserta en Firestore cualquier interés del catálogo base que aún no exista por nombre."""
    col = fs.collection("interests_catalog")
    existing = { (doc.to_dict() or {}).get("name") for doc in col.stream() }
    existing.discard(None)

    # Determina next_id
    current_ids = []
    for doc in col.stream():
        data = doc.to_dict() or {}
        if "id" in data and isinstance(data["id"], int):
            current_ids.append(data["id"])
        elif doc.id.isdigit():
            current_ids.append(int(doc.id))
    next_id = (max(current_ids) + 1) if current_ids else 1

    batch = fs.batch()
    to_add = 0
    for cat, name in BASE_CATALOG:
        if name in existing:
            continue
        doc_ref = col.document(str(next_id))
        batch.set(doc_ref, {"id": next_id, "name": name, "category": cat})
        next_id += 1
        to_add += 1
    if to_add:
        batch.commit()

@router.get("/catalog", response_model=List[InterestOut])
def get_catalog():
    # Auto-seed en Firestore
    _ensure_catalog_firestore()
    return _load_catalog()

@router.get("/me", response_model=UserInterestsOut)
def get_my_interests(decoded: dict = Depends(verify_firebase_token)):
    # Lee IDs desde Firestore y resuelve contra catálogo
    user_doc = fs.collection("users").document(decoded["uid"]).get()
    data = user_doc.to_dict() or {}
    ids = list(sorted(set(int(i) for i in (data.get("interest_ids") or []))))
    if not ids:
        return {"interests": []}
    catalog = {c["id"]: c for c in _load_catalog()}
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
        catalog = {c["id"]: c for c in _load_catalog()}
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
        _ensure_catalog_firestore()

        # Cargar catálogo actual
        catalog_list = _load_catalog()
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
            catalog_list = _load_catalog()
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
