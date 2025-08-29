import React from "react";
import { ScrollView, View, Text, StyleSheet, Alert } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";

import FormInput from "../components/FormInput";
import BigButton from "../components/BigButton";
import { registerUser, loginWithPassword } from "../api/auth";
import { theme } from "../lib/theme";

const schema = z.object({
  full_name: z.string().trim().optional(),
  email: z.string().email("Formato de correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  const onSubmit = async (values: FormData) => {
    try {
      // 1) registra en tu FastAPI (crea user en Firebase + Firestore)
      await registerUser(values);
      // 2) login directo con Firebase Auth
      await loginWithPassword(values.email, values.password);

      Alert.alert("¡Listo!", "Cuenta creada. Bienvenida/o 👏", [
        // 3) onboarding: ir a intereses; luego intereses → preparation
        { text: "Continuar", onPress: () => router.replace("/interests") },
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Error al registrar";
      Alert.alert("Ups", String(msg));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Rellena tus datos. Es rápido y seguro.</Text>

      <Controller
        control={control}
        name="full_name"
        render={({ field: { onChange, value } }) => (
          <FormInput
            label="Nombre (opcional)"
            placeholder="Ej.: Ana Pérez"
            value={value || ""}
            onChangeText={onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <FormInput
            label="Correo"
            placeholder="nombre@correo.com"
            value={value}
            onChangeText={onChange}
            keyboardType="email-address"
            error={errors.email?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <FormInput
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            value={value}
            onChangeText={onChange}
            secureTextEntry
            error={errors.password?.message}
          />
        )}
      />

      <BigButton
        title={isSubmitting ? "Creando..." : "Crear cuenta"}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      />

      <Text style={styles.link} onPress={() => router.replace("/login")}>
        ¿Ya tienes cuenta? Inicia sesión
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: theme.bg, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", color: theme.text, marginBottom: 4 },
  subtitle: { fontSize: 16, color: theme.muted, marginBottom: 18 },
  link: { textAlign: "center", marginTop: 18, fontSize: 16, color: theme.primary, fontWeight: "700" },
});
