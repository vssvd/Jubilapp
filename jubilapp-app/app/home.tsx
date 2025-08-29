import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "../src/lib/theme";

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎉 ¡Bienvenida a JubilApp!</Text>

      <View style={{ height: 24 }} />

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "#4F46E5" }]}
        onPress={() => router.replace("/interests")}
      >
        <Text style={[styles.btnText, { color: "white" }]}>Empezar cuestionario</Text>
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
