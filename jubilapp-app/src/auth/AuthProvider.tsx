import React, { createContext, useEffect, useState, useContext } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "../firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Ctx = { user: User | null; loading: boolean };
const AuthCtx = createContext<Ctx | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (fbUser) => {
      setUser(fbUser);
      try {
        if (fbUser) {
          const token = await fbUser.getIdToken(true);
          await AsyncStorage.setItem("fb_id_token", token); // opcional (debug)
        } else {
          await AsyncStorage.removeItem("fb_id_token");
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  return (
    <AuthCtx.Provider value={{ user, loading }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};
