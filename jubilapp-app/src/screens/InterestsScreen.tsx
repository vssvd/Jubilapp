import React, { useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { theme } from "../lib/theme";
import { useInterview } from "../hooks/useInterview";
import { PreparationLevel } from "../api/preparation";

const PREPARATION_LABELS: Record<PreparationLevel, string> = {
  planificado: "Planificado",
  intermedio: "Intermedio",
  desorientado: "Desorientado",
};

export default function InterestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    questions,
    currentQuestion,
    currentResponse,
    progress,
    status,
    isRecording,
    isProcessing,
    isLastQuestion,
    canAdvance,
    analysis,
    error,
    responses,
    speakQuestion,
    startRecording,
    stopRecording,
    resetCurrentResponse,
    goNext,
  } = useInterview();

  const handleRecordPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleNext = useCallback(async () => {
    try {
      await goNext();
    } catch {
      // los mensajes de error ya se manejan en el hook
    }
  }, [goNext]);

  const timeline = useMemo(() => {
    return questions.map((q, idx) => ({
      question: q,
      index: idx,
      response: responses[q.id],
      isCurrent: currentQuestion?.id === q.id,
    }));
  }, [questions, responses, currentQuestion]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 12 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text }}>🎙️ Entrevista asistida</Text>
        <Text style={{ color: "#4b5563", marginTop: 4 }}>
          Pregunta {progress.current} de {progress.total}
        </Text>

        {error && (
          <View style={{ backgroundColor: "#fee2e2", padding: 12, borderRadius: 12, marginTop: 12 }}>
            <Text style={{ color: "#b91c1c", fontWeight: "600" }}>{error}</Text>
          </View>
        )}

        {currentQuestion && (
          <View
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 18,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e5e7eb",
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 8,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>{currentQuestion.title}</Text>
            {currentQuestion.helper && (
              <Text style={{ color: "#4b5563", marginTop: 8 }}>{currentQuestion.helper}</Text>
            )}

            <View style={{ flexDirection: "row", marginTop: 16, gap: 12, flexWrap: "wrap" }}>
              <TouchableOpacity
                onPress={speakQuestion}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.primary,
                  backgroundColor: "#eef2ff",
                }}
              >
                <Text style={{ color: theme.primary, fontWeight: "700" }}>🔊 Escuchar pregunta</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRecordPress}
                style={{
                  flexGrow: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: isRecording ? "#dc2626" : theme.primary,
                  opacity: isProcessing ? 0.7 : 1,
                }}
                disabled={isProcessing}
              >
                {isRecording ? (
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Detener y guardar</Text>
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Responder hablando</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontWeight: "700", color: theme.text }}>Transcripción</Text>
              {currentResponse?.text ? (
                <View style={{ backgroundColor: "#f3f4f6", padding: 12, borderRadius: 12, marginTop: 8 }}>
                  <Text style={{ color: "#111827" }}>{currentResponse.text}</Text>
                </View>
              ) : (
                <Text style={{ color: "#6b7280", marginTop: 8 }}>
                  Tu respuesta aparecerá aquí luego de grabarla.
                </Text>
              )}
            </View>

            {currentResponse?.text && (
              <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={resetCurrentResponse}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#9ca3af",
                  }}
                  disabled={status === "processing"}
                >
                  <Text style={{ color: "#4b5563", fontWeight: "600" }}>🔁 Volver a grabar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNext}
                  style={{
                    flexGrow: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: theme.primary,
                    opacity: !canAdvance || status === "analyzing" ? 0.6 : 1,
                  }}
                  disabled={!canAdvance || status === "processing" || status === "analyzing"}
                >
                  {status === "analyzing" ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {isLastQuestion ? "Analizar respuestas" : "Siguiente pregunta"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <Text style={{ fontWeight: "700", color: theme.text }}>Respuestas registradas</Text>
          {timeline.map(({ question, index: idx, response, isCurrent }) => (
            <View
              key={question.id}
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 14,
                backgroundColor: isCurrent ? "#eef2ff" : "#f9fafb",
                borderWidth: 1,
                borderColor: isCurrent ? "#c7d2fe" : "#e5e7eb",
              }}
            >
              <Text style={{ fontWeight: "600", color: theme.text }}>
                {idx + 1}. {question.title}
              </Text>
              <Text style={{ color: response?.text ? "#1f2937" : "#9ca3af", marginTop: 6 }}>
                {response?.text ?? "Sin respuesta todavía"}
              </Text>
            </View>
          ))}
        </View>

        {status === "processing" && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24 }}>
            <ActivityIndicator />
            <Text style={{ marginLeft: 8, color: "#4b5563" }}>Transcribiendo tu respuesta…</Text>
          </View>
        )}

        {analysis && (
          <View
            style={{
              marginTop: 28,
              padding: 18,
              borderRadius: 18,
              backgroundColor: "#ecfdf5",
              borderWidth: 1,
              borderColor: "#6ee7b7",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#065f46" }}>Resultados con BERT</Text>
            <Text style={{ color: "#047857", marginTop: 6 }}>
              {analysis.applied
                ? "Guardamos tus intereses y nivel automáticamente."
                : "Revisa estas sugerencias antes de continuar."}
            </Text>

            {analysis.interests.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {analysis.interests.map((item) => (
                  <View
                    key={item.id}
                    style={{ backgroundColor: "#d1fae5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}
                  >
                    <Text style={{ color: "#047857", fontWeight: "700" }}>{item.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {analysis.preparation_level && (
              <Text style={{ marginTop: 14, color: "#047857", fontWeight: "700" }}>
                Nivel estimado: {PREPARATION_LABELS[analysis.preparation_level]}
              </Text>
            )}

            <TouchableOpacity
              onPress={() => router.replace("/location")}
              style={{
                marginTop: 20,
                backgroundColor: theme.primary,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
