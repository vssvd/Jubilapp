import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable, Image, Platform, Dimensions } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/firebaseConfig";               // <-- usa la instancia
import { theme } from "../src/lib/theme";

export default function Index() {
  const H = Dimensions.get("window").height;
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
  const heroUri = (Constants.expoConfig?.extra as any)?.heroUri || process.env.EXPO_PUBLIC_HERO_URI || undefined;
  const heroHeight = Math.min(520, Math.round(H * 0.48));

  return (
    <View style={styles.container}>
      <View style={[styles.heroWrap, { height: heroHeight }]}>
        <Image
          source={heroUri ? { uri: heroUri } : require("../assets/images/hero-couple.png")}
          style={styles.hero}
          resizeMode="cover"
        />
      </View>
      <Text style={styles.title}>JUBILAPP</Text>
      <Text style={styles.subtitle}>Tu apoyo para planear y disfrutar tu jubilación.</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={() => router.push("/login")}>
          <Text style={styles.btnText}>Iniciar sesión</Text>
        </TouchableOpacity>
        <Pressable
          onPress={() => router.push("/register")}
          style={({ hovered, pressed }) => [
            styles.btn,
            styles.outline,
            (hovered || pressed) && { backgroundColor: "#FACC15", borderColor: "#FACC15" },
          ]}
        >
          <Text style={[styles.btnText, styles.outlineText]}>Crear cuenta</Text>
        </Pressable>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/tutorial")}
        style={{ marginTop: 18 }}
        accessibilityRole="link"
      >
        <Text style={styles.helpText}>
          ¿Necesitas ayuda? <Text style={styles.helpLink}>Ver tutorial rápido</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#FAF9F6" },
  heroWrap: {
    width: "94%",
    maxWidth: 620,
    alignSelf: "center",
    marginTop: Platform.select({ ios: 72, android: 48, default: 56 }),
    marginBottom: 12,
    overflow: "hidden",
    borderRadius: 16,
  },
  hero: { width: "100%", height: "100%" },
  title: { fontSize: 36, letterSpacing: 1, color: "#111827", textAlign: "center", fontFamily: "MontserratSemiBold" },
  subtitle: {
    marginTop: 8,
    marginBottom: 24,
    color: "#4B5563",
    textAlign: "center",
    fontFamily: "NunitoRegular",
    fontSize: 18,
    lineHeight: Platform.select({ ios: 22, android: 24, default: 22 }),
    letterSpacing: 0.2,
  },
  buttons: { width: "100%", gap: 16 },
  btn: { paddingVertical: 16, borderRadius: 24, alignItems: "center" },
  primary: { backgroundColor: "#115E59" },
  outline: { borderWidth: 2, borderColor: "#115E59", backgroundColor: "#FFFFFF" },
  btnText: { fontSize: 22, color: "#fff", fontFamily: "MontserratSemiBold" },
  outlineText: { color: "#115E59" },
  helpText: {
    color: "#4B5563",
    fontSize: 14,
    fontFamily: "NunitoRegular",
    lineHeight: Platform.select({ ios: 18, android: 20, default: 18 }),
  },
  helpLink: { color: "#115E59", textDecorationLine: "underline", fontFamily: "NunitoRegular" },
});
