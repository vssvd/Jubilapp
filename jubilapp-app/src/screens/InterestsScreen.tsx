import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { theme } from "../lib/theme";
import { fetchCatalog, fetchMyInterests, saveMyInterests } from "../api/interests";
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

export default function InterestsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [catalog, mine] = await Promise.all([fetchCatalog(), fetchMyInterests()]);

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
          return bestScore >= 0.6 ? best : null; // umbral de similitud
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
        setItems(normalizedList);
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach((it) => {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    });
    return Array.from(map.entries());
  }, [items]);

  const toggle = (idx: number) =>
    setItems((prev) => prev.map((r, i) => (i === idx && r.id !== null ? { ...r, selected: !r.selected } : r)));

  const selectedIds = useMemo(() => items.filter((r) => r.selected && r.id != null).map((r) => r.id!) , [items]);

  const onSave = async () => {
    if (selectedIds.length === 0) {
      Alert.alert("Selecciona al menos uno", "Debes completar el cuestionario para continuar.");
      return;
    }
    setSaving(true);
    try {
      await saveMyInterests(selectedIds);
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
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.bg }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 8, color: theme.text }}>📝 Cuestionario de Intereses</Text>

      {grouped.map(([cat, list]) => (
        <View key={cat} style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: "700", marginBottom: 8, color: theme.text }}>{cat}</Text>
          {list.map((it, i) => {
            const idx = items.indexOf(it);
            const disabled = it.id == null;
            return (
              <TouchableOpacity
                key={`${cat}-${i}`}
                onPress={() => !disabled && toggle(idx)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: it.selected ? theme.primary : "#e5e7eb",
                  backgroundColor: it.selected ? "#eefbf9" : "white",
                  marginBottom: 8,
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 16, color: theme.text }}>{(it.selected ? "☑ " : "☐ ") + it.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={{
          backgroundColor: theme.primary,
          padding: 14,
          borderRadius: 14,
          alignItems: "center",
          opacity: saving ? 0.7 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>
          {saving ? "Guardando..." : "Guardar y continuar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
