import React from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import FormInput from "../components/FormInput";
import BigButton from "../components/BigButton";
import { loginWithPassword } from "../api/auth";
import { theme } from "../lib/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

const schema = z.object({
  email: z.string().email("Formato de correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormData = z.infer<typeof schema>;
type Props = NativeStackScreenProps<any, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }: FormData) => {
    try {
      await loginWithPassword(email, password);
      navigation.replace("Home");
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message === "INVALID_PASSWORD"
          ? "Contraseña incorrecta"
          : e?.response?.data?.error?.message === "EMAIL_NOT_FOUND"
          ? "El usuario no existe"
          : e.message || "No se pudo iniciar sesión";
      Alert.alert("Ups", String(msg));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <Text style={styles.subtitle}>Accede a tus datos guardados.</Text>

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
            placeholder="Tu contraseña"
            value={value}
            onChangeText={onChange}
            secureTextEntry
            error={errors.password?.message}
          />
        )}
      />

      <BigButton title={isSubmitting ? "Ingresando..." : "Ingresar"} onPress={handleSubmit(onSubmit)} disabled={isSubmitting} />

      <Text style={styles.link} onPress={() => navigation.navigate("Register")}>
        ¿No tienes cuenta? Regístrate
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
