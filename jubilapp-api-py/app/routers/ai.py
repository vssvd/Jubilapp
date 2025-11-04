from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from app.domain_ai import analyze_questionnaire, MOBILITY_LEVELS
from app.domain_mobility import validate_mobility_level
from app.firebase import db
from app.schemas_ai import QuestionnaireIn, QuestionnaireOut, SuggestedInterest
from app.security import get_current_uid
from app.services.huggingface import HuggingFaceConfigError, HuggingFaceRequestError
from app.services.interviews import finalize_session


router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/questionnaire", response_model=QuestionnaireOut)
def run_questionnaire(
    payload: QuestionnaireIn,
    uid: str = Depends(get_current_uid),
):
    try:
        result = analyze_questionnaire(
            interest_answers=payload.interest_answers,
            preparation_answer=payload.preparation_answer,
            mobility_answer=payload.mobility_answer,
            top_k=payload.top_k,
        )
    except HuggingFaceConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HuggingFaceRequestError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando cuestionario: {exc}")

    interests = [SuggestedInterest(**row) for row in result.get("interests", [])]
    preparation_level = result.get("preparation_level")
    raw_mobility = result.get("mobility_level")
    try:
        mobility_level = validate_mobility_level(raw_mobility)
    except ValueError:
        mobility_level = None

    applied = False
    if payload.store:
        update: dict = {"updatedAt": SERVER_TIMESTAMP}
        if interests:
            ids = [i.id for i in interests if i.id]
            if ids:
                update["interest_ids"] = ids
                update["interests"] = [i.name for i in interests]
                update["interests_updated_at"] = SERVER_TIMESTAMP
        if preparation_level:
            update["preparation_level"] = preparation_level
        if mobility_level in MOBILITY_LEVELS:
            update["mobility_level"] = mobility_level
        if len(update.keys()) > 1:
            db.collection("users").document(uid).set(update, merge=True)
            applied = True
        if payload.session_id:
            summary = {
                "interests": [i.model_dump() for i in interests],
                "preparation_level": preparation_level,
                "mobility_level": mobility_level if mobility_level in MOBILITY_LEVELS else None,
                "status": "completed" if applied else "draft",
            }
            try:
                finalize_session(uid, payload.session_id, summary)
            except Exception:
                pass

    return QuestionnaireOut(
        interests=interests,
        preparation_level=preparation_level,
        mobility_level=mobility_level if mobility_level in MOBILITY_LEVELS else None,
        applied=applied,
        session_id=payload.session_id,
    )
