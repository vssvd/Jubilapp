import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { registerUser } from "../src/api/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../src/firebaseConfig";
import { theme } from "../src/lib/theme";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const mapAuthError = (err: any): string => {
    const raw = String(err?.message || "");
    const code: string = err?.code || (raw.match(/auth\/[a-z0-9-]+/i)?.[0] ?? "");
    switch (code) {
      case "auth/email-already-in-use":
        return "El email ya está registrado.";
      case "auth/invalid-email":
        return "El correo tiene un formato inválido.";
      case "auth/weak-password":
        return "La contraseña es muy débil.";
      case "auth/network-request-failed":
        return "Sin conexión. Revisa tu internet.";
      default:
        // Si viene del backend, respeta su mensaje (e.g., 409)
        return raw || "No se pudo registrar";
    }
  };

  const onSubmit = async () => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Completa nombre, correo y contraseña.");
      return;
    }
    if (!emailRe.test(email.trim())) {
      Alert.alert("Correo inválido", "Revisa el formato del correo.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Contraseña débil", "Debe tener al menos 6 caracteres.");
      return;
    }

    try {
      setLoading(true);

      // 1. Crear usuario en el backend (FastAPI + Firebase Admin)
      const res = await registerUser({
        full_name: name.trim(),
        email: email.trim(),
        password,
      });

      // 2. Hacer login en Firebase Client SDK para obtener ID token
      await signInWithEmailAndPassword(auth, email.trim(), password);

      // 3. Redirigir a la Home (el cliente ya añadirá el token en requests)
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Ups", mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta ✍️</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre completo"
        placeholderTextColor={theme.muted}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor={theme.muted}
        keyboardType="email-address"
        autoCapitalize="none"
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

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.buttonText, { marginLeft: 8 }]}>Creando cuenta…</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>Registrarse</Text>
        )}
      </TouchableOpacity>

      <Text
        style={styles.link}
        onPress={() => router.push("/login")}
      >
        ¿Ya tienes cuenta? Inicia sesión
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: theme.bg },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
    color: theme.text,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: theme.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: {
    marginTop: 16,
    color: theme.primary,
    fontSize: 15,
    textAlign: "center",
  },
});
