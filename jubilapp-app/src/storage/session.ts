import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "jubilapp.auth";

export interface PersistedSession {
  uid: string;
  token: string;
  storedAt?: number;
}

export async function saveSession(session: PersistedSession) {
  const payload: PersistedSession = {
    ...session,
    storedAt: Date.now(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}

export async function loadSession(): Promise<PersistedSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.uid === "string" && typeof data?.token === "string") {
      return { uid: data.uid, token: data.token, storedAt: data?.storedAt };
    }
  } catch {}
  return null;
}

export async function clearSession() {
  await AsyncStorage.removeItem(KEY);
}
