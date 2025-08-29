// src/api/auth.ts
import { request } from "./client";
import { auth } from "../firebaseConfig";              // ⬅️ usa la instancia central
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export type RegisterPayload = {
  email: string;
  password: string;
  full_name?: string;
};

export type RegisterResponse = {
  uid: string;
  email: string;
  full_name?: string | null;
};

export async function registerUser(payload: RegisterPayload) {
  return request<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: payload,
  });
}

export async function loginWithPassword(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function getFirebaseIdToken(): Promise<string | undefined> {
  const user = auth.currentUser;
  if (!user) return undefined;
  return user.getIdToken(true);
}

export type Me = { uid: string; email: string | null; provider?: string | null };

export async function me(): Promise<Me> {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");
  const provider = user.providerData?.[0]?.providerId ?? null;
  return { uid: user.uid, email: user.email, provider };
}

export async function logout(): Promise<void> {
  await signOut(auth);
}
