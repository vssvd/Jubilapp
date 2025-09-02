import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Platform, AccessibilityInfo, Image } from "react-native";
import * as Speech from "expo-speech";
import { useRouter } from "expo-router";
import { loginWithPassword } from "../src/api/auth";
import { theme } from "../src/lib/theme";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [speaking, setSpeaking] = useState(false);

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
      // Tras iniciar sesión, ir al Home con actividades
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("No se pudo iniciar sesión", mapAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const onAnnounce = () => {
    const msg = "Pantalla de inicio de sesión. Accede a tu espacio personal y organiza tu nueva etapa con facilidad. Campos: Correo y Contraseña. Botón Entrar. Enlace para registrarse.";
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
      <Image source={require("../assets/images/icon.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Iniciar sesión 🔐</Text>
      <Text style={styles.subtitle}>Accede a tu espacio personal y organiza tu nueva etapa con facilidad ✨</Text>

      <View style={styles.inputRow}>
        <Text style={styles.inputIcon} accessibilityElementsHidden>✉️</Text>
        <TextInput
          style={styles.input}
          placeholder="Correo"
          placeholderTextColor="#374151"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          accessible
          accessibilityLabel="Campo de correo"
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
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          accessible
          accessibilityLabel="Campo de contraseña"
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

      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading} accessibilityRole="button" accessibilityLabel="Entrar">
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.btnText, { marginLeft: 8 }]}>Ingresando…</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>ENTRAR</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.trust}>Tu información está segura 🔒</Text>

      <TouchableOpacity onPress={() => router.push("/register")} style={styles.linkBtn}>
        <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onAnnounce} style={styles.accessibilityBtn} accessibilityRole="button">
        <Text style={styles.accessibilityText}>{speaking ? "⏹️ Detener lectura" : "🔊 Leer en voz alta"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: "center" },
  logo: { width: 110, height: 110, alignSelf: "center", marginBottom: 16 },
  title: {
    color: theme.text,
    fontSize: 28,
    marginBottom: 22,
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
    fontSize: 22,
    fontFamily: "NunitoRegular",
  },
  eyeBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  eyeText: { fontSize: 18 },
  btn: { backgroundColor: "#115E59", paddingVertical: 16, borderRadius: 24, alignItems: "center", marginTop: 14 },
  btnText: { color: "#fff", fontSize: 22, fontFamily: "MontserratSemiBold" },
  linkBtn: { marginTop: 16, alignItems: "center" },
  link: { color: "#2563EB", textDecorationLine: "underline", fontFamily: "NunitoRegular", fontSize: 16, lineHeight: Platform.select({ ios: 20, android: 22, default: 20 }) },
  trust: { marginTop: 10, textAlign: "center", color: "#065f46", fontFamily: "NunitoRegular" },
  accessibilityBtn: { marginTop: 10, alignItems: "center" },
  accessibilityText: { color: "#4B5563", fontFamily: "NunitoRegular", fontSize: 14 },
});
