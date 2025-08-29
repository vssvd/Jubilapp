import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Sesión iniciada! Bienvenida a JubilApp 👋</Text>

      <View style={{ height: 24 }} />

      <TouchableOpacity style={styles.btn} onPress={() => router.push("/interests")}>
        <Text style={styles.btnText}>Configurar intereses</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, { backgroundColor: "#2563eb" }]}
                        onPress={() => router.push("/preparation")}>
        <Text style={[styles.btnText, { color: "white" }]}>Indicar nivel de preparación</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: "center", alignItems: "center" },
  title:     { fontSize: 18, textAlign: "center" },
  btn:       { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, backgroundColor: "#e5e7eb", marginTop: 12 },
  btnText:   { fontWeight: "600" },
});


