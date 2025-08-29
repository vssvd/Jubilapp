import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { fetchPreparation, savePreparation, PreparationLevel } from "../api/preparation";
import { useRouter } from "expo-router";

type Option = { key: PreparationLevel; title: string; description: string };

const OPTIONS: Option[] = [
  { key: "planificado",  title: "Planificado",  description: "Tengo metas y actividades definidas." },
  { key: "intermedio",   title: "Intermedio",   description: "Tengo ideas, pero no completamente organizadas." },
  { key: "desorientado", title: "Desorientado", description: "No sé por dónde empezar." },
];

export default function PreparationLevelScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<PreparationLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const current = await fetchPreparation();
        setSelected(current);
      } catch {
        Alert.alert("Error", "No se pudo cargar tu nivel de preparación.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    if (!selected) return Alert.alert("Selecciona un nivel", "Debes elegir exactamente uno.");
    setSaving(true);
    try {
      await savePreparation(selected);
      Alert.alert("Listo", "Tu nivel fue guardado.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Indica tu nivel de preparación</Text>
      <Text style={{ color: "#555", marginBottom: 12 }}>
        Selecciona uno. Puedes cambiarlo luego desde tu perfil.
      </Text>

      {OPTIONS.map((opt) => {
        const active = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setSelected(opt.key)}
            style={{
              borderWidth: 2,
              borderColor: active ? "#2563eb" : "#e5e7eb",
              backgroundColor: active ? "#eff6ff" : "white",
              padding: 14,
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600" }}>{opt.title}</Text>
            <Text style={{ color: "#444", marginTop: 6 }}>{opt.description}</Text>
            {active && <Text style={{ marginTop: 8, fontWeight: "600" }}>Seleccionado</Text>}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={{
          marginTop: "auto",
          backgroundColor: "#2563eb",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? <ActivityIndicator /> : <Text style={{ color: "white", fontWeight: "700" }}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  );
}
