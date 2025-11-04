import Constants from "expo-constants";
import { auth } from "../firebaseConfig";
import { loadSession } from "../storage/session";

function extractHost(uri: string | undefined): string | undefined {
  if (!uri || typeof uri !== "string") return undefined;

  let candidate = uri.trim();
  if (!candidate) return undefined;

  if (candidate.startsWith("exp://")) {
    candidate = candidate.replace(/^exp:\/\//i, "http://");
  } else if (candidate.startsWith("ws://") || candidate.startsWith("wss://")) {
    candidate = candidate.replace(/^ws{1,2}:\/\//i, "http://");
  }

  if (!candidate.includes("://")) {
    return candidate.split(":")[0];
  }

  try {
    const parsed = new URL(candidate);
    return parsed.hostname || undefined;
  } catch {
    const withoutScheme = candidate.replace(/^[a-zA-Z]+:\/\//, "");
    return withoutScheme.split(":")[0];
  }
}

function deriveDevApiBase(): string | undefined {
  const knownUris: (string | undefined)[] = [
    (Constants as any)?.expoConfig?.hostUri,
    (Constants as any)?.manifest2?.extra?.expoGo?.hostUri,
    (Constants as any)?.expoGoConfig?.hostUri,
    (Constants as any)?.manifest?.debuggerHost,
  ];

  for (const uri of knownUris) {
    const host = extractHost(uri);
    if (host && /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      if (__DEV__) {
        console.log("[api] deriveDevApiBase ->", host);
      }
      return `http://${host}:8000`;
    }
  }

  return undefined;
}

const extraBase = ((Constants.expoConfig?.extra as any)?.apiBase || "").trim();
const envBase = (process.env.EXPO_PUBLIC_API_BASE || "").trim();
export const API_BASE: string =
  (envBase && envBase.toLowerCase() !== "auto" ? envBase : "") ||
  (extraBase && extraBase.toLowerCase() !== "auto" ? extraBase : "") ||
  deriveDevApiBase() ||
  "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function getFirebaseIdToken(): Promise<string | undefined> {
  try {
    const user = auth.currentUser;
    if (user) {
      // Evita refrescar en cada request para rendimiento
      return await user.getIdToken();
    }
  } catch {
    // Ignoramos y probamos con la sesión persistida
  }

  const persisted = await loadSession();
  if (!persisted) return undefined;

  const isFresh = !persisted.storedAt || Date.now() - persisted.storedAt < 55 * 60 * 1000;
  return isFresh ? persisted.token : undefined;
}

export async function request<T>(
  path: string,
  options: { method?: HttpMethod; body?: any; token?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { method = "GET", body } = options;
  const token = options.token ?? (await getFirebaseIdToken());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal as any,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    throw new Error(e?.name === "AbortError" ? "Tiempo de espera agotado" : (e?.message || "Error de red"));
  }
  clearTimeout(timeout);

  const text = await res.text();
  if (!res.ok && __DEV__) {
    console.error("[api] request failed", method, path, res.status, res.statusText, text);
  }
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const detail = data?.detail;
    const message =
      (typeof detail === "string" && detail) ||
      (detail && typeof detail === "object" && typeof detail.message === "string" && detail.message) ||
      (typeof data?.message === "string" && data.message) ||
      `HTTP ${res.status}: ${res.statusText}`;
    const error = new Error(message) as Error & { status?: number; data?: any; code?: string };
    error.status = res.status;
    error.data = data;
    if (detail && typeof detail === "object" && typeof detail.code === "string") {
      error.code = detail.code;
    }
    throw error;
  }
  return data as T;
}

export async function authHeader(): Promise<Record<string, string>> {
  const token = await getFirebaseIdToken();
  if (!token) throw new Error("No autenticado");
  return { Authorization: `Bearer ${token}` };
}
