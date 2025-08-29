from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Tuple
from app.database import get_db
from app.schemas_interests import (
    InterestOut,
    UserInterestsIn,
    UserInterestsOut,
    UserInterestsByNamesIn,
)
from app.models_interests import Interest, UserInterest
from app.security import get_current_user


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

def ensure_catalog(db: Session) -> None:
    """Inserta en la tabla cualquier interés del catálogo base que aún no exista."""
    existing = {row.name for row in db.query(Interest.name).all()}
    to_insert = [Interest(name=name, category=cat) for cat, name in BASE_CATALOG if name not in existing]
    if to_insert:
        db.bulk_save_objects(to_insert)
        db.commit()

@router.get("/catalog", response_model=List[InterestOut])
def get_catalog(db: Session = Depends(get_db)):
    # Auto-seed: garantiza que el catálogo base está en la base de datos
    ensure_catalog(db)
    return db.query(Interest).order_by(Interest.category, Interest.name).all()

@router.get("/me", response_model=UserInterestsOut)
def get_my_interests(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = (db.query(Interest)
            .join(UserInterest, UserInterest.interest_id == Interest.id)
            .filter(UserInterest.user_id == current_user.id)
            .order_by(Interest.category, Interest.name))
    return {"interests": q.all()}

@router.put("/me", response_model=UserInterestsOut)
def set_my_interests(payload: UserInterestsIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        # validar ids (sin duplicados)
        ids = sorted(set(int(i) for i in payload.interest_ids))
        if not ids:
            db.query(UserInterest).filter(UserInterest.user_id == current_user.id).delete()
            db.commit()
            return {"interests": []}

        count = db.query(Interest).filter(Interest.id.in_(ids)).count()
        if count != len(ids):
            raise HTTPException(status_code=400, detail="Algunos intereses no existen")

        # reemplazo idempotente
        db.query(UserInterest).filter(UserInterest.user_id == current_user.id).delete()
        db.bulk_save_objects([UserInterest(user_id=current_user.id, interest_id=i) for i in ids])
        db.commit()

        rows = db.query(Interest).filter(Interest.id.in_(ids)).all()
        return {"interests": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando intereses: {e}")

@router.put("/me/by-names", response_model=UserInterestsOut)
def set_my_interests_by_names(payload: UserInterestsByNamesIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    try:
        # normaliza y quita duplicados
        names = sorted(set(n.strip() for n in payload.interest_names if n and n.strip()))
        if not names:
            db.query(UserInterest).filter(UserInterest.user_id == current_user.id).delete()
            db.commit()
            return {"interests": []}

        # Garantiza catálogo base antes de resolver
        ensure_catalog(db)

        # Resuelve IDs, creando cualquier nombre faltante con categoría nula
        existing_map = {r.name: r for r in db.query(Interest).filter(Interest.name.in_(names)).all()}
        to_create = [Interest(name=n) for n in names if n not in existing_map]
        if to_create:
            db.bulk_save_objects(to_create)
            db.commit()
            # volver a cargar creados
            created = db.query(Interest).filter(Interest.name.in_([i.name for i in to_create])).all()
            for r in created:
                existing_map[r.name] = r

        ids = sorted(set(existing_map[n].id for n in names if n in existing_map))

        db.query(UserInterest).filter(UserInterest.user_id == current_user.id).delete()
        db.bulk_save_objects([UserInterest(user_id=current_user.id, interest_id=i) for i in ids])
        db.commit()

        rows = db.query(Interest).filter(Interest.id.in_(ids)).all()
        return {"interests": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando intereses por nombre: {e}")
