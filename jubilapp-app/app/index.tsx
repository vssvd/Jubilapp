import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/firebaseConfig";               // <-- usa la instancia
import { hasInterests, needsPreparation } from "../src/api/onboarding";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoggedIn(!!user);
      if (!user) {
        setChecking(false);
        return;
      }
      try {
        if (!(await hasInterests())) {
          router.replace("/interests");
          return;
        }
        if (await needsPreparation()) {
          router.replace("/preparation");
          return;
        }
        router.replace("/home");
      } catch {
        router.replace("/home");
      } finally {
        setChecking(false);
      }
    });
    return () => unsub();
  }, []);

  if (checking) {
    return (
      <View style={[styles.container, { gap: 12 }]}>
        <ActivityIndicator />
        <Text style={{ color: "white" }}>Cargando…</Text>
      </View>
    );
  }

  if (loggedIn) {
    return (
      <View style={[styles.container, { gap: 12 }]}>
        <ActivityIndicator />
      </View>
    );
  }

  // Landing sin sesión (tu UI original)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>JUBILAPP</Text>
      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => router.push("/login")}>
          <Text style={styles.btnText}>Iniciar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.outline]} onPress={() => router.push("/register")}>
          <Text style={[styles.btnText, styles.outlineText]}>Registrarse</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0B0F14" },
  title: { fontSize: 36, fontWeight: "800", letterSpacing: 1, color: "white", marginBottom: 40 },
  buttons: { width: "100%", gap: 16 },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primary: { backgroundColor: "#4F46E5" },
  outline: { borderWidth: 1, borderColor: "#4F46E5", backgroundColor: "transparent" },
  btnText: { color: "white", fontSize: 16, fontWeight: "700" },
  outlineText: { color: "#4F46E5" },
});
