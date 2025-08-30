import Constants from "expo-constants";
import { auth } from "../firebaseConfig";

function deriveDevApiBase(): string | undefined {
  const hostUri = (Constants as any)?.expoConfig?.hostUri as string | undefined;
  if (!hostUri) return undefined;
  const host = hostUri.split(":")[0];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return `http://${host}:8000`;
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
    if (!user) return undefined;
    // Evita refrescar en cada request para rendimiento
    return await user.getIdToken();
  } catch {
    return undefined;
  }
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
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.detail || data?.message || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function authHeader(): Promise<Record<string, string>> {
  const token = await getFirebaseIdToken();
  if (!token) throw new Error("No autenticado");
  return { Authorization: `Bearer ${token}` };
}
