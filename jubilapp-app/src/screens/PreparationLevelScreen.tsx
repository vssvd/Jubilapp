import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { fetchPreparation, savePreparation, PreparationLevel } from "../api/preparation";
import { analyzeQuestionnaire } from "../api/ai";
import { theme } from "../lib/theme";

type Option = { key: PreparationLevel; title: string; description: string };

const OPTIONS: Option[] = [
  { key: "planificado", title: "Planificado", description: "Tengo metas y actividades definidas." },
  { key: "intermedio", title: "Intermedio", description: "Tengo ideas, pero no completamente organizadas." },
  { key: "desorientado", title: "Desorientado", description: "No sé por dónde empezar." },
];

const labelFor = (level: PreparationLevel) => OPTIONS.find((opt) => opt.key === level)?.title ?? level;

export default function PreparationLevelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PreparationLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiApplied, setAiApplied] = useState(false);

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

  const runAssistant = async () => {
    const answer = aiText.trim();
    if (!answer) {
      Alert.alert("Escríbenos algo", "Describe cómo te sientes para poder ayudarte.");
      return;
    }
    setAiLoading(true);
    try {
      const result = await analyzeQuestionnaire({
        preparation_answer: answer,
        top_k: 1,
        store: true,
      });
      if (result.preparation_level) {
        setSelected(result.preparation_level);
        setAiApplied(Boolean(result.applied));
        setAiVisible(false);
        setAiText("");
        Alert.alert(
          "Listo",
          `Nivel estimado: ${labelFor(result.preparation_level)}${result.applied ? "\n\n✅ Ya lo guardamos en tu perfil." : ""}`,
        );
      } else {
        Alert.alert("Sin resultado", "La IA no pudo estimar tu nivel. Intenta con más detalle.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No pudimos analizar tu respuesta.");
    } finally {
      setAiLoading(false);
    }
  };

  const onSave = async () => {
    if (!selected) return Alert.alert("Selecciona un nivel", "Debes elegir exactamente uno.");
    setSaving(true);
    try {
      await savePreparation(selected);
      Alert.alert("Listo", "Tu nivel fue guardado.", [
        { text: "Ir al inicio", onPress: () => router.replace({ pathname: "/home", params: { onboard: "1" } }) },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
        <Text style={styles.loadingText}>Cargando…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Modal
        animationType="slide"
        transparent
        visible={aiVisible}
        onRequestClose={() => (aiLoading ? null : setAiVisible(false))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🤖 Asistente BERT</Text>
            <Text style={styles.modalSubtitle}>
              Cuéntanos cómo te sientes respecto a tu planificación.
            </Text>
            <TextInput
              value={aiText}
              onChangeText={setAiText}
              multiline
              placeholder="Ej: Tengo varias ideas pero aún no organizo nada concreto."
              placeholderTextColor={theme.muted}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => (!aiLoading ? setAiVisible(false) : null)}
                style={styles.modalCancel}
                disabled={aiLoading}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={runAssistant}
                disabled={aiLoading}
                style={[styles.modalPrimary, aiLoading && styles.disabled]}
              >
                {aiLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>Analizar con IA</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Text style={styles.title}>Indica tu nivel de preparación</Text>
      <Text style={styles.subtitle}>Selecciona uno. Puedes cambiarlo luego desde tu perfil.</Text>

      <TouchableOpacity
        onPress={() => setAiVisible(true)}
        style={styles.assistantCard}
      >
        <Text style={styles.assistantTitle}>🤖 Autocompletar con BERT</Text>
        <Text style={styles.assistantSubtitle}>
          Describe cómo te sientes y te sugerimos un nivel automático.
        </Text>
      </TouchableOpacity>

      {aiApplied && selected && (
        <View style={styles.aiAppliedBanner}>
          <Text style={styles.aiAppliedText}>🤖 Nivel sugerido y guardado: {labelFor(selected)}</Text>
        </View>
      )}

      {OPTIONS.map((opt) => {
        const active = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => {
              setSelected(opt.key);
              setAiApplied(false);
            }}
            style={[styles.optionCard, active && styles.optionCardActive]}
          >
            <Text style={styles.optionTitle}>{opt.title}</Text>
            <Text style={styles.optionDescription}>{opt.description}</Text>
            {active && <Text style={styles.optionBadge}>Seleccionado</Text>}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={[styles.primaryButton, saving && styles.disabled]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.bg },
  loadingText: { marginTop: 8, color: theme.muted },
  screen: { flex: 1, paddingHorizontal: 16, backgroundColor: theme.bg },
  title: { fontSize: 24, fontWeight: "800", color: theme.text },
  subtitle: { color: theme.muted, marginVertical: 10 },
  assistantCard: {
    borderWidth: 1.5,
    borderColor: theme.primary,
    backgroundColor: "#ecfdf5",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  assistantTitle: { fontWeight: "700", color: theme.primary, fontSize: 16 },
  assistantSubtitle: { color: theme.primary, marginTop: 6 },
  aiAppliedBanner: { backgroundColor: "#f3f4f6", padding: 12, borderRadius: 12, marginBottom: 14 },
  aiAppliedText: { color: theme.text, fontWeight: "600" },
  optionCard: {
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  optionCardActive: {
    borderColor: theme.primary,
    backgroundColor: "#ecfdf5",
  },
  optionTitle: { fontSize: 18, fontWeight: "700", color: theme.text },
  optionDescription: { color: theme.muted, marginTop: 6 },
  optionBadge: { marginTop: 8, fontWeight: "700", color: theme.primary },
  primaryButton: {
    marginTop: 12,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  disabled: { opacity: 0.7 },
  modalOverlay: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(15,23,42,0.45)" },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: theme.text, marginBottom: 6 },
  modalSubtitle: { color: theme.muted, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 12,
    minHeight: 120,
    textAlignVertical: "top",
    color: theme.text,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 20 },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 12 },
  modalCancelText: { fontWeight: "600", color: theme.muted },
  modalPrimary: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalPrimaryText: { color: "#fff", fontWeight: "700" },
});
