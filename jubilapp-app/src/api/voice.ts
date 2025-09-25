import { API_BASE, authHeader } from "./client";

export type TranscribeVoiceResponse = {
  session_id: string;
  text: string;
  audio_url?: string | null;
  audio_path?: string | null;
  upload_error?: string | null;
};

type Params = {
  sessionId?: string;
  questionId: string;
  questionText: string;
  uri: string;
  mimeType?: string;
  filename?: string;
  sampleRateHz?: number;
};

export async function transcribeVoice(params: Params): Promise<TranscribeVoiceResponse> {
  const headers = await authHeader();

  const form = new FormData();
  form.append("question_id", params.questionId);
  form.append("question_text", params.questionText);
  if (params.sessionId) form.append("session_id", params.sessionId);
  if (params.sampleRateHz) form.append("sample_rate_hz", String(params.sampleRateHz));
  if (params.mimeType) form.append("mime_type", params.mimeType);
  form.append("audio", {
    uri: params.uri,
    name: params.filename ?? "respuesta.wav",
    type: params.mimeType ?? "audio/wav",
  } as any);

  const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
    method: "POST",
    headers,
    body: form,
  });

  const raw = await res.text();
  let payload: any = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : undefined) ||
      (typeof payload === "string" && payload.trim()) ||
      `HTTP ${res.status}`;
    if (__DEV__) {
      console.error("transcribeVoice error", res.status, payload);
    }
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Respuesta inesperada del servidor");
  }
  return payload as TranscribeVoiceResponse;
}
