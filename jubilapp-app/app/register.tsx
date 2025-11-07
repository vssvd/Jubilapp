import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  AccessibilityInfo,
  Image,
} from "react-native";
import * as Speech from "expo-speech";
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
  const [emailConfirm, setEmailConfirm] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [speaking, setSpeaking] = useState(false);

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
    if (!name.trim() || !email.trim() || !password.trim() || !emailConfirm.trim() || !passwordConfirm.trim()) {
      Alert.alert("Campos requeridos", "Completa nombre, correo, confirmaciones y contraseña.");
      return;
    }
    if (!emailRe.test(email.trim())) {
      Alert.alert("Correo inválido", "Revisa el formato del correo.");
      return;
    }
    if (email.trim() !== emailConfirm.trim()) {
      Alert.alert("Correo", "El correo y su confirmación no coinciden.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Contraseña débil", "Debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert("Contraseña", "La contraseña y su confirmación no coinciden.");
      return;
    }

    try {
      setLoading(true);

      // 1. Crear usuario en el backend (FastAPI + Firebase Admin)
      await registerUser({
        full_name: name.trim(),
        email: email.trim(),
        password,
      });

      // 2. Hacer login en Firebase Client SDK para obtener ID token
      await signInWithEmailAndPassword(auth, email.trim(), password);

      // 3. Ir al onboarding: Intereses → (luego) Preparación → Home
      router.replace("/interests");
    } catch (e: any) {
      Alert.alert("Ups", mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const onAnnounce = () => {
    const msg = "Pantalla de registro. Ingresa tu nombre, correo y una contraseña. Presiona Registrarse. También puedes ir a Iniciar sesión si ya tienes cuenta. Tu información está segura.";
    try { AccessibilityInfo.announceForAccessibility(msg); } catch {}
    try {
      if (speaking) {
        Speech.stop();
        setSpeaking(false);
        return;
      }
      setSpeaking(true);
      Speech.speak(msg, {
        language: "es-ES",
        rate: 0.95,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/icon.png")} style={styles.illustration} resizeMode="contain" />
      <Text style={styles.title}>Crear cuenta ✍️</Text>
      <Text style={styles.subtitle}>Empieza a organizar tu nueva etapa de manera fácil y segura 🌟</Text>

      <View style={styles.inputRow}>
        <Text style={styles.inputIcon} accessibilityElementsHidden>📛</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          placeholderTextColor="#374151"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          accessible
          accessibilityLabel="Nombre completo"
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputRow}>
        <Text style={styles.inputIcon} accessibilityElementsHidden>✉️</Text>
        <TextInput
          style={styles.input}
          placeholder="Correo"
          placeholderTextColor="#374151"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          textContentType="emailAddress"
          accessible
          accessibilityLabel="Correo"
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputRow}>
        <Text style={styles.inputIcon} accessibilityElementsHidden>🔁</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirmar correo"
          placeholderTextColor="#374151"
          keyboardType="email-address"
          autoCapitalize="none"
          value={emailConfirm}
          onChangeText={setEmailConfirm}
          autoComplete="email"
          textContentType="emailAddress"
          accessible
          accessibilityLabel="Confirmar correo"
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputRow}>
        <Text style={styles.inputIcon} accessibilityElementsHidden>🔑</Text>
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#374151"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          autoComplete="password"
          textContentType="password"
          accessible
          accessibilityLabel="Contraseña"
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          onPress={() => setShowPassword((s) => !s)}
          style={styles.eyeBtn}
        >
          <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputRow}>
        <Text style={styles.inputIcon} accessibilityElementsHidden>✅</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirmar contraseña"
          placeholderTextColor="#374151"
          secureTextEntry={!showPassword}
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          autoComplete="password"
          textContentType="password"
          accessible
          accessibilityLabel="Confirmar contraseña"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={onSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Registrarse"
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

      <Text style={styles.trust}>Tu información está segura 🔒</Text>

      <Text
        style={styles.link}
        onPress={() => router.push("/login")}
        accessibilityRole="link"
      >
        ¿Ya tienes cuenta? Inicia sesión
      </Text>

      <TouchableOpacity onPress={onAnnounce} style={styles.accessibilityBtn} accessibilityRole="button">
        <Text style={styles.accessibilityText}>{speaking ? "⏹️ Detener lectura" : "🔊 Leer en voz alta"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: theme.bg },
  illustration: { width: 110, height: 110, alignSelf: "center", marginBottom: 16 },
  title: {
    fontSize: 28,
    marginBottom: 22,
    color: theme.text,
    textAlign: "center",
    fontFamily: "MontserratSemiBold",
    lineHeight: Platform.select({ ios: 32, android: 34, default: 32 }),
  },
  subtitle: {
    color: "#374151",
    fontFamily: "NunitoRegular",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
    lineHeight: Platform.select({ ios: 20, android: 22, default: 20 }),
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: { fontSize: 20, marginRight: 8 },
  input: {
    flex: 1,
    height: 58,
    backgroundColor: "#fff",
    color: theme.text,
    fontFamily: "NunitoRegular",
    fontSize: 22,
  },
  eyeBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  eyeText: { fontSize: 18 },
  button: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 14,
  },
  buttonText: { color: "#fff", fontSize: 22, fontFamily: "MontserratSemiBold" },
  link: {
    marginTop: 18,
    color: "#2563EB",
    textDecorationLine: "underline",
    fontSize: 16,
    fontFamily: "NunitoRegular",
    lineHeight: Platform.select({ ios: 20, android: 22, default: 20 }),
    textAlign: "center",
  },
  trust: { marginTop: 10, textAlign: "center", color: "#065f46", fontFamily: "NunitoRegular" },
  accessibilityBtn: { marginTop: 10, alignItems: "center" },
  accessibilityText: { color: "#4B5563", fontFamily: "NunitoRegular", fontSize: 14 },
});
