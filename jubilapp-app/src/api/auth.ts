import { request } from "./client";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterResponse {
  uid: string;
  email: string;
  full_name: string;
  token: string;
}

export interface LoginUserResponse {
  access_token: string;
}

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

export async function logout(): Promise<void> {
  await signOut(auth);
}

// Compatibilidad con app/login.tsx: devuelve un objeto con access_token
export async function loginUser(input: LoginPayload): Promise<LoginUserResponse> {
  const { email, password } = input;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken(true);
  return { access_token: token };
}
