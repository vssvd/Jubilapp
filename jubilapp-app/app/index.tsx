import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/firebaseConfig";               // <-- usa la instancia
import { theme } from "../src/lib/theme";

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
      // Siempre muestra Home primero tras iniciar sesión para ver la bienvenida
      try { router.replace("/home"); } finally { setChecking(false); }
    });
    return () => unsub();
  }, []);

  if (checking) {
    return (
      <View style={[styles.container, { gap: 12 }]}>
        <ActivityIndicator />
        <Text style={{ color: theme.text }}>Cargando…</Text>
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
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.bg },
  title: { fontSize: 36, fontWeight: "800", letterSpacing: 1, color: theme.text, marginBottom: 40 },
  buttons: { width: "100%", gap: 16 },
  btn: { paddingVertical: 14, borderRadius: theme.radius, alignItems: "center" },
  primary: { backgroundColor: theme.primary },
  outline: { borderWidth: 1, borderColor: theme.primary, backgroundColor: "transparent" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  outlineText: { color: theme.primary },
});
