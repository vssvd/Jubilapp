import Constants from "expo-constants";
import { auth } from "../src/firebaseConfig";

export const API_BASE: string =
  (Constants.expoConfig?.extra as any)?.apiBase ||
  process.env.EXPO_PUBLIC_API_BASE ||
  "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ID token desde Firebase Web SDK
async function getFirebaseIdToken(): Promise<string | undefined> {
  try {
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    if (!user) return undefined;
    return await user.getIdToken(true);
  } catch {
    return undefined;
  }
}

export async function request<T>(
  path: string,
  options: { method?: HttpMethod; body?: any; token?: string } = {}
): Promise<T> {
  const { method = "GET", body } = options;
  const token = options.token ?? (await getFirebaseIdToken());

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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