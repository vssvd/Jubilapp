import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { theme } from "../src/lib/theme";
import { logout } from "../src/api/auth";

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onboard?: string }>();
  const [showBanner, setShowBanner] = useState(!!params.onboard);

  useEffect(() => {
    if (params.onboard) {
      const t = setTimeout(() => setShowBanner(false), 3500);
      return () => clearTimeout(t);
    }
  }, [params.onboard]);

  return (
    <View style={styles.container}>
      {showBanner && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Listo, tu perfil inicial quedó configurado ✅</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={styles.bannerBtn} onPress={() => router.push("/profile")}>
              <Text style={styles.bannerBtnText}>Ver perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bannerBtnGhost} onPress={() => setShowBanner(false)}>
              <Text style={styles.bannerBtnGhostText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <Text style={styles.title}>🎉 ¡Bienvenida a JubilApp!</Text>

      <View style={{ height: 24 }} />

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "#10B981" }]}
        onPress={() => router.push("/profile")}
      >
        <Text style={[styles.btnText, { color: "white" }]}>Editar perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "#4F46E5" }]}
        onPress={() => router.replace("/interests")}
      >
        <Text style={[styles.btnText, { color: "white" }]}>Empezar cuestionario</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "#EF4444" }]}
        onPress={async () => { await logout(); router.replace("/login"); }}
      >
        <Text style={[styles.btnText, { color: "white" }]}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg },
  title:     { fontSize: 20, textAlign: "center", color: theme.text, fontWeight: "800" },
  btn:       { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, backgroundColor: theme.primary, marginTop: 12 },
  btnText:   { fontWeight: "700", color: "#fff" },
  banner: { position: "absolute", top: 16, left: 16, right: 16, backgroundColor: "#ecfdf5", borderColor: "#10B981", borderWidth: 1, borderRadius: 12, padding: 12 },
  bannerText: { color: "#065f46", textAlign: "center", fontWeight: "700" },
  bannerBtn: { backgroundColor: "#10B981", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  bannerBtnText: { color: "#fff", fontWeight: "700" },
  bannerBtnGhost: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  bannerBtnGhostText: { color: "#065f46", fontWeight: "700" },
});
