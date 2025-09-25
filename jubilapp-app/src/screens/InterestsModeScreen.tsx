import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { theme } from "../lib/theme";

export default function InterestsModeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 16 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text }}>Configurar intereses</Text>
        <Text style={{ marginTop: 8, color: "#4b5563", fontSize: 16 }}>
          Elige cómo quieres registrar tus intereses y tu nivel de preparación.
        </Text>

        <View
          style={{
            marginTop: 28,
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            shadowColor: "#000",
            shadowOpacity: 0.04,
            shadowRadius: 12,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text }}>🎙️ Entrevista asistida</Text>
          <Text style={{ marginTop: 8, color: "#4b5563" }}>
            Responde hablando y deja que la IA transcriba y sugiera intereses automáticamente.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/interests/assistant")}
            style={{
              marginTop: 16,
              backgroundColor: theme.primary,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Usar entrevista</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 20,
            backgroundColor: "#f9fafb",
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: "#e5e7eb",
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text }}>📝 Ingresar manualmente</Text>
          <Text style={{ marginTop: 8, color: "#4b5563" }}>
            Selecciona tus intereses desde el catálogo y define tu nivel por tu cuenta.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/interests/manual")}
            style={{
              marginTop: 16,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.primary,
              alignItems: "center",
              backgroundColor: "#fff",
            }}
          >
            <Text style={{ color: theme.primary, fontWeight: "800", fontSize: 16 }}>Elegir manualmente</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ marginTop: 24, color: "#6b7280", fontSize: 14 }}>
          Podrás cambiar de método más adelante desde tu perfil.
        </Text>
      </ScrollView>
    </View>
  );
}
