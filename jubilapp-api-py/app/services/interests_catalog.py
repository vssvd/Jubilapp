from __future__ import annotations

from typing import Dict, List, Tuple

from app.firebase import db as fs

BASE_CATALOG: List[Tuple[str, str]] = [
    ("Creatividad y Arte", "Pintura / Dibujo"),
    ("Creatividad y Arte", "Manualidades (tejido, carpintería, cerámica)"),
    ("Creatividad y Arte", "Música (escuchar, cantar, tocar instrumento)"),
    ("Creatividad y Arte", "Fotografía"),
    ("Creatividad y Arte", "Escritura / lectura creativa"),
    ("Deporte y Bienestar", "Caminatas / trekking"),
    ("Deporte y Bienestar", "Gimnasia suave / yoga / pilates"),
    ("Deporte y Bienestar", "Natación"),
    ("Deporte y Bienestar", "Baile"),
    ("Deporte y Bienestar", "Ciclismo"),
    ("Deporte y Bienestar", "Pesca"),
    ("Deporte y Bienestar", "Jardinería"),
    ("Aprendizaje y Desarrollo Personal", "Idiomas"),
    ("Aprendizaje y Desarrollo Personal", "Historia y cultura"),
    ("Aprendizaje y Desarrollo Personal", "Tecnología (apps, redes sociales)"),
    ("Aprendizaje y Desarrollo Personal", "Cursos online / talleres"),
    ("Aprendizaje y Desarrollo Personal", "Club de lectura"),
    ("Social y Comunitario", "Voluntariado"),
    ("Social y Comunitario", "Clubes sociales / centros de adulto mayor"),
    ("Social y Comunitario", "Actividades religiosas o espirituales"),
    ("Social y Comunitario", "Juegos de mesa / cartas"),
    ("Social y Comunitario", "Actividades con nietos / familia"),
    ("Salud y Cuidado Personal", "Meditación / mindfulness"),
    ("Salud y Cuidado Personal", "Cocina saludable"),
    ("Salud y Cuidado Personal", "Autocuidado (skincare, spa casero, etc.)"),
    ("Salud y Cuidado Personal", "Control de salud / chequeos"),
    ("Ocio y Cultura", "Viajes y turismo local"),
    ("Ocio y Cultura", "Museos, teatro, cine"),
    ("Ocio y Cultura", "Gastronomía (recetas, restaurantes)"),
    ("Ocio y Cultura", "Eventos culturales y ferias"),
    ("Tecnología y Digital", "Redes sociales"),
    ("Tecnología y Digital", "Videollamadas con familia / amigos"),
    ("Tecnología y Digital", "Juegos digitales (apps, consolas, PC)"),
    ("Tecnología y Digital", "Fotografía y edición digital"),
    ("Tecnología y Digital", "Apps de finanzas, salud, transporte"),
]


def _snapshot() -> List:
    return list(fs.collection("interests_catalog").stream())


def ensure_catalog_firestore() -> None:
    col = fs.collection("interests_catalog")
    docs = _snapshot()

    existing_names = set()
    current_ids: List[int] = []
    for doc in docs:
        data = doc.to_dict() or {}
        name = data.get("name")
        if name:
            existing_names.add(name)
        if isinstance(data.get("id"), int):
            current_ids.append(data["id"])
        elif str(doc.id).isdigit():
            current_ids.append(int(doc.id))

    next_id = (max(current_ids) + 1) if current_ids else 1

    batch = fs.batch()
    to_add = 0
    for category, name in BASE_CATALOG:
        if name in existing_names:
            continue
        doc_ref = col.document(str(next_id))
        batch.set(doc_ref, {"id": next_id, "name": name, "category": category})
        next_id += 1
        to_add += 1
    if to_add:
        batch.commit()


def load_catalog() -> List[Dict]:
    docs = fs.collection("interests_catalog").stream()
    out: List[Dict] = []
    for doc in docs:
        data = doc.to_dict() or {}
        try:
            iid = int(data.get("id") or (doc.id if str(doc.id).isdigit() else 0))
        except Exception:
            iid = 0
        out.append({
            "id": iid,
            "name": data.get("name") or "",
            "category": data.get("category"),
        })
    out.sort(key=lambda row: ((row.get("category") or ""), (row.get("name") or "")))
    return out
