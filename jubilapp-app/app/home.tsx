import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "../src/lib/theme";
import { logout } from "../src/api/auth";

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
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
});
