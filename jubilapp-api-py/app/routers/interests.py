from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas_interests import InterestOut, UserInterestsIn, UserInterestsOut
from app.models_interests import Interest, UserInterest
from app.security import get_current_user


router = APIRouter(prefix="/interests", tags=["Interests"])

@router.get("/catalog", response_model=List[InterestOut])
def get_catalog(db: Session = Depends(get_db)):
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
    # validar ids
    ids = list(set(payload.interest_ids))
    if not ids:
        # permitir guardar vacío para “ninguno”
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
