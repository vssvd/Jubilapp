import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { loginWithPassword } from "../src/api/auth";
import { theme } from "../src/lib/theme";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const mapAuthError = (err: any): string => {
    const raw = String(err?.message || "");
    const code: string = err?.code || (raw.match(/auth\/[a-z0-9-]+/i)?.[0] ?? "");
    switch (code) {
      case "auth/invalid-email":
        return "El correo tiene un formato inválido.";
      case "auth/user-not-found":
        return "El usuario no existe.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Contraseña incorrecta.";
      case "auth/too-many-requests":
        return "Demasiados intentos. Intenta más tarde.";
      case "auth/network-request-failed":
        return "Sin conexión. Revisa tu internet.";
      default:
        return raw || "No se pudo iniciar sesión";
    }
  };

  const onSubmit = async () => {
    // validación básica
    if (!email.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Ingresa tu correo y contraseña.");
      return;
    }
    try {
      setLoading(true);
      await loginWithPassword(email.trim(), password);
      // Redirige a tu pantalla principal (ajusta ruta)
      router.replace("/home"); // crea /app/home.tsx o cambia por "/"
    } catch (e: any) {
      Alert.alert("No se pudo iniciar sesión", mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión 🔐</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo"
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={theme.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.btnText, { marginLeft: 8 }]}>Ingresando…</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>Entrar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/register")} style={styles.linkBtn}>
        <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: "center" },
  title: { color: theme.text, fontSize: 28, fontWeight: "800", marginBottom: 24, textAlign: "center" },
  input: {
    backgroundColor: "#fff", color: theme.text, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: theme.border,
  },
  btn: { backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  linkBtn: { marginTop: 16, alignItems: "center" },
  link: { color: theme.primary },
});
