// src/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// Inicializa Firebase una sola vez
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 👇 Intenta obtener Auth; si aún no está registrado, lo registra
let auth: Auth;
try {
  auth = getAuth(app);
} catch {
  // Registra el componente de Auth (sin persistencia especial en Expo Go)
  initializeAuth(app);
  auth = getAuth(app);
}

export { app, auth };
git rm --cached jubilapp-app
