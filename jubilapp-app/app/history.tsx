import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import BottomNav from "../components/BottomNav";
import { theme } from "../src/lib/theme";
import { ActivityHistoryEntry, fetchActivityHistory } from "../src/api/activities";
import { useSafeAreaInsets } from "react-native-safe-area-context";


type HistoryRange = "7d" | "30d" | "90d" | "365d" | "all";

const RANGE_OPTIONS: { key: HistoryRange; label: string; days?: number }[] = [
  { key: "7d", label: "7 días", days: 7 },
  { key: "30d", label: "30 días", days: 30 },
  { key: "90d", label: "90 días", days: 90 },
  { key: "365d", label: "12 meses", days: 365 },
  { key: "all", label: "Todo" },
];

const NONE_CATEGORY = "__none__";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatCompletedAt(value?: string | null): string {
  if (!value) return "Sin fecha registrada";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Fecha desconocida";
  try {
    const dateFormatter = new Intl.DateTimeFormat("es-CL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const timeFormatter = new Intl.DateTimeFormat("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const datePart = dateFormatter.format(dt);
    const timePart = timeFormatter.format(dt);
    const normalized = datePart ? datePart.charAt(0).toUpperCase() + datePart.slice(1) : datePart;
    return `${normalized} · ${timePart} hrs`;
  } catch {
    const day = dt.getDate().toString().padStart(2, "0");
    const month = (dt.getMonth() + 1).toString().padStart(2, "0");
    const year = dt.getFullYear();
    const hours = dt.getHours().toString().padStart(2, "0");
    const minutes = dt.getMinutes().toString().padStart(2, "0");
    return `${day}/${month}/${year} · ${hours}:${minutes} hrs`;
  }
}

function formatMonthLabel(dt: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
    const label = formatter.format(dt);
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return `${dt.getMonth() + 1}/${dt.getFullYear()}`;
  }
}

function normalizeOrigin(value?: string | null): string {
  if (!value) return "";
  const presets: Record<string, string> = {
    "rutina-diaria": "Rutina diaria",
    "catalogo-interno": "Catálogo interno",
    "recomendacion": "Recomendación",
  };
  if (presets[value]) return presets[value];
  return value
    .split(/[-_]/)
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [selectedRange, setSelectedRange] = useState<HistoryRange>("30d");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allEntries, setAllEntries] = useState<ActivityHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const params: { fromDate?: string; toDate?: string; limit?: number } = { limit: 250 };
        const option = RANGE_OPTIONS.find(r => r.key === selectedRange);
        if (option?.days) {
          const now = new Date();
          const from = new Date(now.getTime() - (option.days - 1) * MS_PER_DAY);
          params.fromDate = from.toISOString();
          params.toDate = now.toISOString();
        }
        const data = await fetchActivityHistory(params);
        setAllEntries(data);
      } catch (e: any) {
        setError(e?.message || "No pudimos cargar tu historial.");
        setAllEntries([]);
      } finally {
        if (!silent) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    },
    [selectedRange],
  );

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      return () => {};
    }, [loadHistory]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory({ silent: true });
  }, [loadHistory]);

  const categoryOptions = useMemo(() => {
    const labels = new Map<string, string>();
    allEntries.forEach(entry => {
      const raw = (entry.category || "").trim();
      if (raw) {
        if (!labels.has(raw)) labels.set(raw, raw);
      } else if (!labels.has(NONE_CATEGORY)) {
        labels.set(NONE_CATEGORY, "Sin categoría");
      }
    });
    return Array.from(labels.entries()).sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [allEntries]);

  const filteredEntries = useMemo(() => {
    if (!selectedCategory) return allEntries;
    if (selectedCategory === NONE_CATEGORY) {
      return allEntries.filter(entry => !(entry.category || "").trim());
    }
    return allEntries.filter(entry => (entry.category || "").trim() === selectedCategory);
  }, [allEntries, selectedCategory]);

  const summaryByPeriod = useMemo(() => {
    const stats = new Map<string, { count: number; label: string }>();
    filteredEntries.forEach(entry => {
      const raw = entry.completedAt || entry.createdAt;
      if (!raw) return;
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${(dt.getMonth() + 1).toString().padStart(2, "0")}`;
      const label = formatMonthLabel(dt);
      const current = stats.get(key);
      if (current) {
        current.count += 1;
      } else {
        stats.set(key, { count: 1, label });
      }
    });
    return Array.from(stats.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredEntries]);

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 108 }]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.titleEmoji}>📘</Text>
          <Text style={styles.titleText}>Historial de actividades</Text>
        </View>
        <Text style={styles.subtitle}>
          Revisa tus actividades completadas, filtra por período y categoría para seguir tu progreso.
        </Text>
      </View>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Rango de fechas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {RANGE_OPTIONS.map(option => {
            const active = selectedRange === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setSelectedRange(option.key)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Categoría</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Pressable
            key="all"
            onPress={() => setSelectedCategory(null)}
            style={[styles.chip, selectedCategory === null && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedCategory === null }}
          >
            <Text style={[styles.chipText, selectedCategory === null && styles.chipTextActive]}>Todas</Text>
          </Pressable>
          {categoryOptions.map(([value, label]) => {
            const active = selectedCategory === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSelectedCategory(value)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Resumen del período</Text>
        <Text style={styles.summaryHighlight}>{filteredEntries.length} actividades</Text>
        {summaryByPeriod.length > 0 ? (
          summaryByPeriod.slice(0, 4).map(item => (
            <View key={item.key} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryCount}>{item.count}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.summaryEmpty}>Aún no hay registros para este filtro.</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={styles.loaderText}>Cargando historial…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>No pudimos cargar tus actividades.</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadHistory()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const category = (item.category || "").trim();
            const origin = normalizeOrigin(item.origin);
            return (
              <View style={styles.itemCard}>
                <Text style={styles.itemEmoji}>{item.emoji || "📝"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemMeta}>{formatCompletedAt(item.completedAt || item.createdAt)}</Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={category ? styles.itemBadge : styles.itemBadgeMuted}>
                      {category ? `🎯 ${category}` : "Sin categoría"}
                    </Text>
                    {origin ? <Text style={styles.itemOrigin}>{origin}</Text> : null}
                  </View>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
          contentContainerStyle={
            filteredEntries.length === 0
              ? styles.listEmptyContainer
              : { paddingBottom: 140, paddingTop: 12 }
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Aún no registras actividades completadas en este período.
            </Text>
          }
        />
      )}

      <BottomNav active="history" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  header: { marginBottom: 18 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleEmoji: { fontSize: 26 },
  titleText: { fontFamily: "MontserratSemiBold", fontSize: 22, color: theme.text },
  subtitle: { marginTop: 6, color: "#4B5563", fontFamily: "NunitoRegular", lineHeight: 20 },
  filters: { marginBottom: 18 },
  filterLabel: { fontFamily: "MontserratSemiBold", color: theme.text, marginBottom: 8 },
  chipsRow: { gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#DCFCE7", borderColor: "#10B981" },
  chipText: { fontFamily: "NunitoRegular", color: "#4B5563" },
  chipTextActive: { color: "#065F46", fontFamily: "MontserratSemiBold" },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 18,
  },
  summaryTitle: { fontFamily: "MontserratSemiBold", color: theme.text, marginBottom: 6 },
  summaryHighlight: { fontFamily: "MontserratSemiBold", fontSize: 20, color: "#065F46", marginBottom: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  summaryLabel: { fontFamily: "NunitoRegular", color: "#4B5563" },
  summaryCount: { fontFamily: "MontserratSemiBold", color: theme.text },
  summaryEmpty: { fontFamily: "NunitoRegular", color: "#9CA3AF" },
  loader: { alignItems: "center", gap: 12, paddingVertical: 40 },
  loaderText: { fontFamily: "NunitoRegular", color: "#4B5563" },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  errorTitle: { fontFamily: "MontserratSemiBold", color: "#B91C1C", fontSize: 16 },
  errorText: { fontFamily: "NunitoRegular", color: "#991B1B", textAlign: "center" },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#F87171",
  },
  retryButtonText: { color: "#fff", fontFamily: "MontserratSemiBold" },
  itemCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  itemEmoji: { fontSize: 28 },
  itemTitle: { fontFamily: "MontserratSemiBold", fontSize: 17, color: theme.text },
  itemMeta: { fontFamily: "NunitoRegular", color: "#6B7280", marginTop: 4 },
  itemMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  itemBadge: {
    backgroundColor: "#EEF2FF",
    color: "#4338CA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontFamily: "NunitoRegular",
    fontSize: 13,
  },
  itemBadgeMuted: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontFamily: "NunitoRegular",
    fontSize: 13,
  },
  itemOrigin: { fontFamily: "NunitoRegular", color: "#047857", fontSize: 13 },
  listEmptyContainer: { paddingTop: 60, paddingBottom: 140, alignItems: "center" },
  emptyText: { fontFamily: "NunitoRegular", color: "#6B7280", textAlign: "center", paddingHorizontal: 12 },
});
