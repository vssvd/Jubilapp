import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { theme } from "../lib/theme";
import { fetchCatalog, fetchMyInterests, saveMyInterests, saveMyInterestsByNames } from "../api/interests";
import { useRouter } from "expo-router";

type Item = { id: number | null; name: string; category: string; selected: boolean };

// Cuestionario fijo (orden y etiquetas)
const QUESTIONNAIRE: { category: string; items: string[] }[] = [
  { category: "Creatividad y Arte", items: [
    "Pintura / Dibujo",
    "Manualidades (tejido, carpintería, cerámica)",
    "Música (escuchar, cantar, tocar instrumento)",
    "Fotografía",
    "Escritura / lectura creativa",
  ]},
  { category: "Deporte y Bienestar", items: [
    "Caminatas / trekking",
    "Gimnasia suave / yoga / pilates",
    "Natación",
    "Baile",
    "Ciclismo",
    "Pesca",
    "Jardinería",
  ]},
  { category: "Aprendizaje y Desarrollo Personal", items: [
    "Idiomas",
    "Historia y cultura",
    "Tecnología (apps, redes sociales)",
    "Cursos online / talleres",
    "Club de lectura",
  ]},
  { category: "Social y Comunitario", items: [
    "Voluntariado",
    "Clubes sociales / centros de adulto mayor",
    "Actividades religiosas o espirituales",
    "Juegos de mesa / cartas",
    "Actividades con nietos / familia",
  ]},
  { category: "Salud y Cuidado Personal", items: [
    "Meditación / mindfulness",
    "Cocina saludable",
    "Autocuidado (skincare, spa casero, etc.)",
    "Control de salud / chequeos",
  ]},
  { category: "Ocio y Cultura", items: [
    "Viajes y turismo local",
    "Museos, teatro, cine",
    "Gastronomía (recetas, restaurantes)",
    "Eventos culturales y ferias",
  ]},
  { category: "Tecnología y Digital", items: [
    "Redes sociales",
    "Videollamadas con familia / amigos",
    "Juegos digitales (apps, consolas, PC)",
    "Fotografía y edición digital",
    "Apps de finanzas, salud, transporte",
  ]},
];

// Etiqueta con emoji por categoría (solo visual)
const categoryWithEmoji = (cat: string): string => ({
  "Creatividad y Arte": "🎨 Creatividad y Arte",
  "Deporte y Bienestar": "🧘‍♀️ Deporte y Bienestar",
  "Aprendizaje y Desarrollo Personal": "🎓 Aprendizaje y Desarrollo Personal",
  "Social y Comunitario": "🤝 Social y Comunitario",
  "Salud y Cuidado Personal": "🩺 Salud y Cuidado Personal",
  "Ocio y Cultura": "🎭 Ocio y Cultura",
  "Tecnología y Digital": "💻 Tecnología y Digital",
}[cat] || cat);

export default function InterestsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Carga catálogo primero; si falla, mostramos cuestionario estático sin IDs
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

        // Utilidades de normalización y similitud ligera
        const normalize = (s: string) =>
          s
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .replace(/\s*[()/,-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const toTokens = (s: string) => Array.from(new Set(normalize(s).split(" ")));
        const jaccard = (a: string, b: string) => {
          const A = new Set(toTokens(a));
          const B = new Set(toTokens(b));
          let inter = 0;
          A.forEach((t) => { if (B.has(t)) inter++; });
          const union = A.size + B.size - inter;
          return union ? inter / union : 0;
        };

        // Índices por nombre normalizado
        const byName = new Map<string, { id: number; raw: string; category: string }>();
        for (const c of catalog) byName.set(normalize(c.name), { id: c.id, raw: c.name, category: c.category || "" });
        const selectedIds = new Set(mine.map((m) => m.id));

        // Encuentra el mejor match por igualdad o similitud de tokens
        const findBest = (label: string): { id: number; category: string } | null => {
          const n = normalize(label);
          const exact = byName.get(n);
          if (exact) return { id: exact.id, category: exact.category };
          let best: { id: number; category: string } | null = null;
          let bestScore = 0;
          for (const [, v] of byName) {
            const score = jaccard(label, v.raw);
            if (score > bestScore) {
              bestScore = score;
              best = { id: v.id, category: v.category };
            }
          }
          // si hay contención fuerte de texto, acepta
          const contains = normalize(label).includes(normalize(best?.category ? '' : (byName.get(n)?.raw || ''))) ? 0 : 0; // noop para types
          const sA = normalize(label);
          let sB = '';
          for (const [, v] of byName) { sB = normalize(v.raw); if (sA.includes(sB) || sB.includes(sA)) { best = { id: v.id, category: v.category }; bestScore = 1; break; } }
          return bestScore >= 0.4 ? best : null; // umbral más permisivo
        };

        const normalizedList: Item[] = [];
        for (const section of QUESTIONNAIRE) {
          for (const label of section.items) {
            const match = findBest(label);
            const id = match?.id ?? null;
            normalizedList.push({
              id,
              name: label,
              category: section.category,
              selected: id != null && selectedIds.has(id),
            });
          }
        }
        // Si no hay catálogo, igualmente mostramos el cuestionario (deshabilitado para guardar)
        setItems(normalizedList);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar el cuestionario");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, number[]>();
    items.forEach((it, idx) => {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(idx);
    });
    return Array.from(map.entries());
  }, [items]);

  const toggle = (idx: number) =>
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));

  const selectedIds = useMemo(() => items.filter((r) => r.selected && r.id != null).map((r) => r.id!) , [items]);

  const onSave = async () => {
    const anySelected = items.some((i) => i.selected);
    if (!anySelected) {
      Alert.alert("Selecciona al menos uno", "Debes completar el cuestionario para continuar.");
      return;
    }
    const selectedNames = items.filter((i) => i.selected).map((i) => i.name);
    setSaving(true);
    try {
      if (selectedIds.length > 0) {
        await saveMyInterests(selectedIds);
      } else {
        await saveMyInterestsByNames(selectedNames);
      }
      router.replace("/preparation"); // siguiente paso obligatorio
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar");
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
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 8, color: theme.text }}>📝 Cuestionario de Intereses</Text>

        {grouped.map(([cat, idxs]) => (
          <View key={cat} style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "700", marginBottom: 8, color: theme.text }}>{categoryWithEmoji(cat)}</Text>
            {idxs.map((idx) => {
              const it = items[idx];
              return (
                <TouchableOpacity
                  key={`${cat}-${idx}`}
                  onPress={() => toggle(idx)}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: it.selected ? theme.primary : "#e5e7eb",
                    backgroundColor: it.selected ? "#eefbf9" : "white",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 16, color: theme.text }}>{(it.selected ? "✅ " : "⬜️ ") + it.name}</Text>
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
          backgroundColor: theme.primary,
          padding: 14,
          borderRadius: 14,
          alignItems: "center",
          opacity: saving ? 0.7 : 1,
          marginHorizontal: 16,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>
          {saving ? "Guardando..." : "Guardar y continuar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
