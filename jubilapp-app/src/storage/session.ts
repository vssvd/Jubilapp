import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "jubilapp.auth";

export async function saveSession(token: string) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ token }));
}

export async function loadSession(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const { token } = JSON.parse(raw);
    return token ?? null;
  } catch { return null; }
}

export async function clearSession() {
  await AsyncStorage.removeItem(KEY);
}
