from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional
from uuid import uuid4

from google.api_core import exceptions as g_exceptions
from google.cloud import speech

from app.firebase import bucket


@dataclass(frozen=True)
class AudioUploadResult:
    storage_path: Optional[str]
    signed_url: Optional[str]


class TranscriptionError(RuntimeError):
    pass


_speech_client: speech.SpeechClient | None = None


def _client() -> speech.SpeechClient:
    global _speech_client
    if _speech_client is None:
        try:
            _speech_client = speech.SpeechClient()
        except Exception as exc:  # pragma: no cover - requiere credenciales válidas
            raise TranscriptionError(f"No se pudo inicializar SpeechClient: {exc}") from exc
    return _speech_client


def upload_audio_bytes(uid: str, session_id: str, *, data: bytes, filename: str | None = None,
                       content_type: str | None = None) -> AudioUploadResult:
    if not bucket:
        raise TranscriptionError("Storage bucket no configurado")
    if not data:
        raise TranscriptionError("Audio vacío")

    name = filename or "audio.wav"
    _, ext = os.path.splitext(name)
    if not ext:
        ext = mimetypes.guess_extension(content_type or "audio/wav") or ".wav"
    blob_name = f"interviews/{uid}/{session_id}/{uuid4().hex}{ext}"
    blob = bucket.blob(blob_name)
    try:
        blob.upload_from_string(data, content_type=content_type or "audio/wav")
    except g_exceptions.NotFound as exc:
        raise TranscriptionError(
            "No se encontró el bucket de Firebase Storage. Revisa la variable FIREBASE_STORAGE_BUCKET."
        ) from exc
    except Exception as exc:
        raise TranscriptionError(f"No se pudo subir el audio: {exc}") from exc

    signed_url: Optional[str] = None
    try:
        signed_url = blob.generate_signed_url(expiration=timedelta(days=7))
    except Exception:
        signed_url = None

    return AudioUploadResult(storage_path=blob_name, signed_url=signed_url)


def _resolve_encoding(mime_type: str | None) -> speech.RecognitionConfig.AudioEncoding:
    if not mime_type:
        return speech.RecognitionConfig.AudioEncoding.LINEAR16
    mime = mime_type.lower()
    if "3gp" in mime or "amr" in mime:
        return speech.RecognitionConfig.AudioEncoding.AMR_WB
    if "wav" in mime or "x-caf" in mime or "lpcm" in mime:
        return speech.RecognitionConfig.AudioEncoding.LINEAR16
    return speech.RecognitionConfig.AudioEncoding.LINEAR16


def transcribe_audio_bytes(audio_bytes: bytes, *, sample_rate_hz: int | None = None,
                           language_code: str = "es-CL", mime_type: str | None = None) -> str:
    if not audio_bytes:
        raise TranscriptionError("Audio vacío")
    client = _client()

    audio = speech.RecognitionAudio(content=audio_bytes)
    encoding = _resolve_encoding(mime_type)
    effective_sample_rate = sample_rate_hz
    if effective_sample_rate is None:
        effective_sample_rate = 16000 if encoding == speech.RecognitionConfig.AudioEncoding.AMR_WB else 44100
    config = speech.RecognitionConfig(
        encoding=encoding,
        language_code=language_code,
        alternative_language_codes=["es-ES", "es"],
        enable_automatic_punctuation=True,
        audio_channel_count=1,
        sample_rate_hertz=effective_sample_rate,
    )

    try:
        response = client.recognize(config=config, audio=audio)
    except g_exceptions.GoogleAPIError as exc:
        raise TranscriptionError(f"Error en Speech-to-Text: {exc}") from exc
    except Exception as exc:
        raise TranscriptionError(f"Error inesperado en Speech-to-Text: {exc}") from exc

    transcripts = []
    for result in response.results:
        if result.alternatives:
            transcripts.append(result.alternatives[0].transcript.strip())
    transcript = " ".join(transcripts).strip()
    if not transcript:
        raise TranscriptionError("No se obtuvo ninguna transcripción")
    return transcript
