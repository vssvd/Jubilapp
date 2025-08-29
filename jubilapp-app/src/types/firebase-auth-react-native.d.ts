// src/types/firebase-auth-react-native.d.ts
declare module "firebase/auth/react-native" {
  export * from "firebase/auth";
  // Tipamos el helper que falta en TS
  export function getReactNativePersistence(storage: any): any;
}
