import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { registerUser } from "../src/api/auth";
import { saveSession } from "../src/storage/session";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Completa nombre, correo y contraseña.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Contraseña", "Debe tener al menos 6 caracteres.");
      return;
    }
    try {
      setLoading(true);
      const res = await registerUser({ name: name.trim(), email: email.trim(), password });
      await saveSession(res.access_token);
      router.replace("/home"); // Ajusta a tu pantalla principal
    } catch (e: any) {
      Alert.alert("No se pudo registrar", e.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Correo"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>Registrarme</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F14", padding: 24, justifyContent: "center" },
  title: { color: "white", fontSize: 28, fontWeight: "800", marginBottom: 24, textAlign: "center" },
  input: {
    backgroundColor: "#111827", color: "white", borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: "#1F2937",
  },
  btn: { backgroundColor: "#10B981", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 6 },
  btnText: { color: "white", fontWeight: "700", fontSize: 16 },
});
