// src/firebaseConfig.ts
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { Platform } from "react-native";
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>;
const env = (k: string) => process.env[k] || extra[k.replace("EXPO_PUBLIC_", "")] || extra[k] || "";

// Normaliza storageBucket si viene con dominio de web viewer
const projectId = env("EXPO_PUBLIC_FIREBASE_PROJECT_ID");
let storageBucket = env("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET");
if (!storageBucket && projectId) storageBucket = `${projectId}.appspot.com`;
if (/\.firebasestorage\.app$/i.test(storageBucket) && projectId) {
  storageBucket = `${projectId}.appspot.com`;
}

const firebaseConfig = {
  apiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId,
  storageBucket,
  messagingSenderId: env("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("EXPO_PUBLIC_FIREBASE_APP_ID"),
};

// Inicializa la app UNA sola vez
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Registra el componente Auth según la plataforma para RN (usa Cordova entrypoint en RN)
try {
  if (Platform.OS === "web") {
    require("firebase/auth");
  } else {
    require("firebase/auth/cordova");
  }
} catch {}

// Inicializa Auth de forma segura (RN/Web). Si necesitas persistencia RN avanzada, podemos añadir initializeAuth más adelante.
const auth: Auth = getAuth(app);

export { app, auth };
