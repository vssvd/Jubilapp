from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from firebase_admin import firestore

from app.security import get_current_uid
from app.services.voice import AudioUploadResult, TranscriptionError, transcribe_audio_bytes, upload_audio_bytes
from app.services.interviews import save_turn

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/voice", tags=["Voice"])


@router.post("/transcribe")
async def transcribe_audio(
    *,
    question_id: str = Form(...),
    question_text: str = Form(...),
    session_id: str | None = Form(None),
    sample_rate_hz: int | None = Form(None),
    mime_type: str | None = Form(None),
    audio: UploadFile = File(...),
    uid: str = Depends(get_current_uid),
):
    sid = session_id or uuid4().hex
    raw = await audio.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Archivo de audio vacío")

    upload_error: str | None = None
    uploaded: AudioUploadResult = AudioUploadResult(storage_path=None, signed_url=None)
    try:
        uploaded = upload_audio_bytes(
            uid,
            sid,
            data=raw,
            filename=audio.filename,
            content_type=audio.content_type,
        )
    except TranscriptionError as exc:
        upload_error = str(exc)
        logger.warning("No se pudo subir audio para %s/%s: %s", uid, sid, exc)
    except Exception as exc:  # pragma: no cover - casos inesperados
        upload_error = "Error inesperado al subir el audio"
        logger.exception("Error inesperado subiendo audio para %s/%s", uid, sid)

    try:
        transcript = transcribe_audio_bytes(raw, sample_rate_hz=sample_rate_hz, mime_type=mime_type)
    except TranscriptionError as exc:
        logger.warning("Fallo transcribiendo audio para %s/%s: %s", uid, sid, exc)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:  # Seguridad adicional
        logger.exception("Error inesperado transcribiendo audio para %s/%s", uid, sid)
        raise HTTPException(status_code=500, detail="Error inesperado al transcribir audio") from exc

    turn = {
        "question_id": question_id,
        "question": question_text,
        "transcript": transcript,
        "audio_path": uploaded.storage_path,
        "audio_url": uploaded.signed_url,
        "created_at": firestore.SERVER_TIMESTAMP,
    }
    if upload_error:
        turn["upload_error"] = upload_error
    try:
        save_turn(uid, sid, turn)
    except Exception as exc:
        logger.warning("No se pudo guardar turn en Firestore para %s/%s: %s", uid, sid, exc)

    return {
        "session_id": sid,
        "text": transcript,
        "audio_url": uploaded.signed_url,
        "audio_path": uploaded.storage_path,
        "upload_error": upload_error,
    }
