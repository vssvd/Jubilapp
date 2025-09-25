import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { theme } from "../lib/theme";
import { fetchCatalog, fetchMyInterests, saveMyInterests, saveMyInterestsByNames } from "../api/interests";

type Item = { id: number | null; name: string; category: string; selected: boolean };

type QuestionnaireSection = {
  category: string;
  items: string[];
};

const QUESTIONNAIRE: QuestionnaireSection[] = [
  {
    category: "Creatividad y Arte",
    items: [
      "Pintura / Dibujo",
      "Manualidades (tejido, carpintería, cerámica)",
      "Música (escuchar, cantar, tocar instrumento)",
      "Fotografía",
      "Escritura / lectura creativa",
    ],
  },
  {
    category: "Deporte y Bienestar",
    items: [
      "Caminatas / trekking",
      "Gimnasia suave / yoga / pilates",
      "Natación",
      "Baile",
      "Ciclismo",
      "Pesca",
      "Jardinería",
    ],
  },
  {
    category: "Aprendizaje y Desarrollo Personal",
    items: [
      "Idiomas",
      "Historia y cultura",
      "Tecnología (apps, redes sociales)",
      "Cursos online / talleres",
      "Club de lectura",
    ],
  },
  {
    category: "Social y Comunitario",
    items: [
      "Voluntariado",
      "Clubes sociales / centros de adulto mayor",
      "Actividades religiosas o espirituales",
      "Juegos de mesa / cartas",
      "Actividades con nietos / familia",
    ],
  },
  {
    category: "Salud y Cuidado Personal",
    items: [
      "Meditación / mindfulness",
      "Cocina saludable",
      "Autocuidado (skincare, spa casero, etc.)",
      "Control de salud / chequeos",
    ],
  },
  {
    category: "Ocio y Cultura",
    items: [
      "Viajes y turismo local",
      "Museos, teatro, cine",
      "Gastronomía (recetas, restaurantes)",
      "Eventos culturales y ferias",
    ],
  },
  {
    category: "Tecnología y Digital",
    items: [
      "Redes sociales",
      "Videollamadas con familia / amigos",
      "Juegos digitales (apps, consolas, PC)",
      "Fotografía y edición digital",
      "Apps de finanzas, salud, transporte",
    ],
  },
];

const categoryWithEmoji = (category: string): string =>
  ({
    "Creatividad y Arte": "🎨 Creatividad y Arte",
    "Deporte y Bienestar": "🧘‍♀️ Deporte y Bienestar",
    "Aprendizaje y Desarrollo Personal": "🎓 Aprendizaje y Desarrollo Personal",
    "Social y Comunitario": "🤝 Social y Comunitario",
    "Salud y Cuidado Personal": "🩺 Salud y Cuidado Personal",
    "Ocio y Cultura": "🎭 Ocio y Cultura",
    "Tecnología y Digital": "💻 Tecnología y Digital",
  }[category] || category);

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[()/,\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) => Array.from(new Set(normalize(value).split(" ")));

const jaccard = (a: string, b: string) => {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  let intersection = 0;
  A.forEach((token) => {
    if (B.has(token)) intersection += 1;
  });
  const union = A.size + B.size - intersection;
  return union ? intersection / union : 0;
};

const findBestMatch = (
  label: string,
  catalogIndex: Map<string, { id: number; name: string; category: string }>,
): { id: number; category: string } | null => {
  const normalized = normalize(label);
  const exact = catalogIndex.get(normalized);
  if (exact) return { id: exact.id, category: exact.category };

  let best: { id: number; category: string } | null = null;
  let bestScore = 0;
  for (const [, meta] of catalogIndex) {
    const score = jaccard(meta.name, label);
    if (score > bestScore) {
      bestScore = score;
      best = { id: meta.id, category: meta.category };
    }
    if (bestScore >= 0.55) break;
  }
  return bestScore >= 0.4 ? best : null;
};

export default function ManualInterestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let catalog: { id: number; name: string; category?: string | null }[] = [];
        let mine: { id: number; name: string; category?: string | null }[] = [];
        try {
          catalog = await fetchCatalog();
        } catch {
          catalog = [];
        }
        try {
          mine = await fetchMyInterests();
        } catch {
          mine = [];
        }

        const byName = new Map<string, { id: number; name: string; category: string }>();
        catalog.forEach((entry) => {
          byName.set(normalize(entry.name), {
            id: entry.id,
            name: entry.name,
            category: entry.category || "Otros",
          });
        });
        const selected = new Set(mine.map((entry) => entry.id));

        const questionnaireItems: Item[] = [];
        QUESTIONNAIRE.forEach((section) => {
          section.items.forEach((label) => {
            const match = findBestMatch(label, byName);
            const id = match?.id ?? null;
            questionnaireItems.push({
              id,
              name: label,
              category: section.category,
              selected: id != null && selected.has(id),
            });
          });
        });
        setItems(questionnaireItems);
      } catch (err: any) {
        Alert.alert("Error", err?.message ?? "No se pudo cargar el cuestionario de intereses.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, number[]>();
    items.forEach((item, index) => {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }
      map.get(item.category)!.push(index);
    });
    return Array.from(map.entries());
  }, [items]);

  const toggle = (index: number) =>
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item)));

  const selectedIds = useMemo(() => items.filter((item) => item.selected && item.id != null).map((item) => item.id!), [items]);

  const onSave = async () => {
    const selectedNames = items.filter((item) => item.selected).map((item) => item.name);
    if (!selectedNames.length) {
      Alert.alert("Selecciona al menos uno", "Completa el cuestionario antes de continuar.");
      return;
    }
    setSaving(true);
    try {
      if (selectedIds.length > 0) {
        await saveMyInterests(selectedIds);
      } else {
        await saveMyInterestsByNames(selectedNames);
      }
      Alert.alert("Guardado", "Tus intereses se guardaron correctamente.", [
        { text: "Continuar", onPress: () => router.replace("/location") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "No se pudo guardar tus intereses");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 12 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: theme.text }}>📝 Cuestionario de Intereses</Text>
        <Text style={{ marginTop: 6, color: "#4b5563" }}>
          Marca las actividades que más te representen. Siempre podrás editarlas desde tu perfil.
        </Text>

        {grouped.map(([category, indexes]) => (
          <View key={category} style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 10, color: theme.text }}>
              {categoryWithEmoji(category)}
            </Text>
            {indexes.map((idx) => {
              const item = items[idx];
              const active = item.selected;
              return (
                <TouchableOpacity
                  key={`${category}-${idx}`}
                  onPress={() => toggle(idx)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: active ? theme.primary : "#e5e7eb",
                    backgroundColor: active ? "#ecfdf5" : "#fff",
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 16, color: theme.text }}>{(active ? "✅ " : "⬜️ ") + item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: theme.primary,
          paddingVertical: 16,
          borderRadius: 16,
          alignItems: "center",
          opacity: saving ? 0.7 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>
          {saving ? "Guardando…" : "Guardar y continuar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
