import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";

import {
  fetchAdminStatus,
  fetchAdminStats,
  fetchAdminUsers,
  type AdminStats,
  type AdminStatsFilters,
  type AdminUser,
  type AdminUserFilters,
} from "../../src/api/admin";
import { theme } from "../../src/lib/theme";

type FilterState = {
  startDate: string;
  endDate: string;
};

type AdminPanelView = "menu" | "filters" | "stats";

const EMPTY_FILTERS: FilterState = { startDate: "", endDate: "" };
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    const formatter = new Intl.DateTimeFormat("es-CL", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const formatted = formatter.format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date
      .getDate()
      .toString()
      .padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  }
}

function statusBadge(status: string): { label: string; backgroundColor: string; color: string } {
  switch (status) {
    case "inactive":
      return { label: "Inactiva", backgroundColor: "#F3F4F6", color: "#4B5563" };
    case "active":
      return { label: "Activa", backgroundColor: "#DCFCE7", color: "#15803D" };
    default:
      return { label: "Sin dato", backgroundColor: "#FEF3C7", color: "#92400E" };
  }
}

function formatNumber(value: number): string {
  try {
    return new Intl.NumberFormat("es-CL").format(value);
  } catch {
    return String(value);
  }
}

function formatMetric(value: number): string {
  if (Number.isInteger(value)) {
    return formatNumber(value);
  }
  return value.toFixed(1);
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = (value.getMonth() + 1).toString().padStart(2, "0");
  const day = value.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultStatsRange(): FilterState {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end),
  };
}

function toStatsFilters(state: FilterState): AdminStatsFilters {
  const payload: AdminStatsFilters = {};
  if (state.startDate) payload.startDate = state.startDate;
  if (state.endDate) payload.endDate = state.endDate;
  return payload;
}

function shortDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [accessChecked, setAccessChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [currentFilters, setCurrentFilters] = useState<AdminUserFilters>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const defaultStatsRange = useMemo(() => buildDefaultStatsRange(), []);
  const [statsFilters, setStatsFilters] = useState<FilterState>(defaultStatsRange);
  const [currentStatsFilters, setCurrentStatsFilters] = useState<AdminStatsFilters>({
    startDate: defaultStatsRange.startDate,
    endDate: defaultStatsRange.endDate,
  });
  const [statsFilterError, setStatsFilterError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeView, setActiveView] = useState<AdminPanelView>("menu");
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    (navigation as any)?.setOptions?.({
      headerShown: true,
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.replace("/home")} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: theme.primary, fontWeight: "700" }}>{"< Volver"}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, router]);

  const loadStats = useCallback(
    async (params?: AdminStatsFilters) => {
      const filtersToUse = params ?? currentStatsFilters;
      const queryPayload = filtersToUse && Object.keys(filtersToUse).length > 0 ? filtersToUse : undefined;
      setStatsLoading(true);
      setStatsError(null);
      try {
        const data = await fetchAdminStats(queryPayload);
        setStats(data);
        if (params !== undefined) {
          setCurrentStatsFilters(filtersToUse);
        }
      } catch (e: any) {
        setStatsError(e?.message ?? "No se pudo cargar las estadísticas.");
      } finally {
        setStatsLoading(false);
      }
    },
    [currentStatsFilters],
  );

  const loadUsers = useCallback(
    async (params?: AdminUserFilters) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminUsers(params);
        setUsers(data.items);
        setCurrentFilters(params ?? {});
      } catch (e: any) {
        if (typeof e?.status === "number" && e.status === 403) {
          setIsAdmin(false);
          setError("No tienes permisos para ver esta sección.");
        } else {
          setError(e?.message ?? "No se pudo cargar la lista.");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const verifyAccessAndLoad = useCallback(async () => {
    setAccessChecked(false);
    setAccessError(null);
    try {
      const status = await fetchAdminStatus();
      setIsAdmin(status.is_admin);
      if (status.is_admin) {
        await Promise.all([loadStats(currentStatsFilters), loadUsers({})]);
      }
    } catch (e: any) {
      setAccessError(e?.message ?? "No se pudo verificar el acceso.");
    } finally {
      setAccessChecked(true);
    }
  }, [currentStatsFilters, loadStats, loadUsers]);

  useEffect(() => {
    void verifyAccessAndLoad();
  }, [verifyAccessAndLoad]);

  const applyFilters = useCallback(async () => {
    if (filters.startDate && !DATE_REGEX.test(filters.startDate)) {
      setFilterError("Usa el formato AAAA-MM-DD para la fecha inicial.");
      return;
    }
    if (filters.endDate && !DATE_REGEX.test(filters.endDate)) {
      setFilterError("Usa el formato AAAA-MM-DD para la fecha final.");
      return;
    }
    setFilterError(null);
    const payload: AdminUserFilters = {
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    };
    await loadUsers(payload);
  }, [filters, loadUsers]);

  const clearFilters = useCallback(async () => {
    setFilters({ ...EMPTY_FILTERS });
    setFilterError(null);
    await loadUsers({});
  }, [loadUsers]);

  const applyStatsFilters = useCallback(async () => {
    if (statsFilters.startDate && !DATE_REGEX.test(statsFilters.startDate)) {
      setStatsFilterError("Usa el formato AAAA-MM-DD para la fecha inicial.");
      return;
    }
    if (statsFilters.endDate && !DATE_REGEX.test(statsFilters.endDate)) {
      setStatsFilterError("Usa el formato AAAA-MM-DD para la fecha final.");
      return;
    }
    setStatsFilterError(null);
    await loadStats(toStatsFilters(statsFilters));
  }, [loadStats, statsFilters]);

  const clearStatsFilters = useCallback(async () => {
    const defaults = buildDefaultStatsRange();
    setStatsFilters(defaults);
    setStatsFilterError(null);
    await loadStats(toStatsFilters(defaults));
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUsers(currentFilters);
    } finally {
      setRefreshing(false);
    }
  }, [loadUsers, currentFilters]);

  const userFiltersHeader = useMemo(() => {
    if (!isAdmin) return null;
    return (
      <View style={styles.filters}>
        <Text style={styles.sectionTitle}>Filtro por fecha de registro</Text>
        <Text style={styles.helpText}>Introduce fechas en formato AAAA-MM-DD.</Text>
        <View style={styles.filterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Desde</Text>
            <TextInput
              value={filters.startDate}
              onChangeText={(value) => setFilters((prev) => ({ ...prev, startDate: value }))}
              placeholder="2024-01-01"
              style={styles.input}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hasta</Text>
            <TextInput
              value={filters.endDate}
              onChangeText={(value) => setFilters((prev) => ({ ...prev, endDate: value }))}
              placeholder="2024-12-31"
              style={styles.input}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </View>
        </View>
        {filterError ? <Text style={styles.filterError}>{filterError}</Text> : null}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.outlineBtn]} onPress={() => { void clearFilters(); }}>
            <Text style={[styles.actionBtnText, styles.outlineBtnText]}>Limpiar</Text>
          </TouchableOpacity>
          <View style={{ width: 12 }} />
          <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={() => { void applyFilters(); }}>
            <Text style={styles.actionBtnText}>Aplicar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            Mostrando <Text style={styles.metaStrong}>{users.length}</Text> usuarios
          </Text>
          {currentFilters.startDate || currentFilters.endDate ? (
            <Text style={styles.metaChip}>
              Filtro activo
            </Text>
          ) : null}
        </View>
        <Text style={styles.statusHint}>Estado “Inactiva” = sin actividad en los últimos 30 días.</Text>
      </View>
    );
  }, [applyFilters, clearFilters, currentFilters.endDate, currentFilters.startDate, filterError, filters.endDate, filters.startDate, isAdmin, users.length]);

  const statsPanel = useMemo(() => {
    if (!isAdmin) return null;
    const summary = stats?.summary;
    const recentDaily = stats?.dailyActive ? stats.dailyActive.slice(-10) : [];
    const maxDaily = recentDaily.reduce((max, item) => Math.max(max, item.activeUsers), 0);
    const topActivities = stats?.topActivities ? stats.topActivities.slice(0, 5) : [];
    const categoryItems = stats?.categoryBreakdown ? stats.categoryBreakdown.slice(0, 5) : [];

    return (
      <View style={styles.statsPanel}>
        <Text style={styles.sectionTitle}>Estadísticas de uso</Text>
        <Text style={styles.helpText}>Selecciona un rango para revisar MAU/DAU, actividades destacadas y categorías.</Text>
        <View style={styles.filterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Desde</Text>
            <TextInput
              value={statsFilters.startDate}
              onChangeText={(value) => setStatsFilters((prev) => ({ ...prev, startDate: value }))}
              placeholder="2024-01-01"
              style={styles.input}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hasta</Text>
            <TextInput
              value={statsFilters.endDate}
              onChangeText={(value) => setStatsFilters((prev) => ({ ...prev, endDate: value }))}
              placeholder="2024-12-31"
              style={styles.input}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </View>
        </View>
        {statsFilterError ? <Text style={styles.filterError}>{statsFilterError}</Text> : null}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.outlineBtn]} onPress={() => { void clearStatsFilters(); }}>
            <Text style={[styles.actionBtnText, styles.outlineBtnText]}>Limpiar</Text>
          </TouchableOpacity>
          <View style={{ width: 12 }} />
          <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={() => { void applyStatsFilters(); }}>
            <Text style={styles.actionBtnText}>Actualizar</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.noticeBox, { marginTop: 12 }]}>
          <Text style={styles.noticeTitle}>Exportación</Text>
          <Text style={styles.noticeText}>
            Estamos habilitando una nueva forma de descargar estos datos. Por ahora puedes revisarlos dentro de la app.
          </Text>
        </View>
        {statsLoading ? (
          <View style={styles.statsLoadingRow}>
            <ActivityIndicator color={theme.primary} />
            <Text style={styles.loadingHint}>Calculando métricas…</Text>
          </View>
        ) : null}
        {statsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{statsError}</Text>
          </View>
        ) : null}
        {summary ? (
          <>
            <View style={[styles.meta, { marginTop: 12 }]}>
              <Text style={styles.metaText}>
                Rango aplicado:{" "}
                <Text style={styles.metaStrong}>
                  {summary.rangeStart} → {summary.rangeEnd}
                </Text>
              </Text>
              <Text style={styles.metaChip}>Actualizado {formatDateTime(stats!.generatedAt)}</Text>
            </View>
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>MAU</Text>
                <Text style={styles.metricValue}>{formatMetric(summary.mauCurrent)}</Text>
                <Text style={styles.metricHint}>Mes en curso</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>DAU promedio</Text>
                <Text style={styles.metricValue}>{formatMetric(summary.dauAverage)}</Text>
                <Text style={styles.metricHint}>Usuarios diarios</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Actividades</Text>
                <Text style={styles.metricValue}>{formatNumber(summary.totalActivities)}</Text>
                <Text style={styles.metricHint}>Completadas</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Usuarios únicos</Text>
                <Text style={styles.metricValue}>{formatNumber(summary.uniqueUsers)}</Text>
                <Text style={styles.metricHint}>En el rango</Text>
              </View>
            </View>
            {recentDaily.length ? (
              <View style={styles.dailyPanel}>
                <Text style={styles.subSectionTitle}>DAU últimos {recentDaily.length} días</Text>
                <View style={styles.barChart}>
                  {recentDaily.map((point) => {
                    const height = maxDaily ? Math.max(4, (point.activeUsers / maxDaily) * 60) : 4;
                    return (
                      <View key={point.date} style={styles.barColumn}>
                        <View style={[styles.barValue, { height }]} />
                        <Text style={styles.barLabel}>{shortDayLabel(point.date)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <View style={styles.topSection}>
              <Text style={styles.subSectionTitle}>Top actividades</Text>
              {topActivities.length ? (
                topActivities.map((item, index) => (
                  <View key={`${item.title}-${index}`} style={styles.topRow}>
                    <View style={styles.topRank}>
                      <Text style={styles.topRankText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topTitle}>{item.title}</Text>
                      <Text style={styles.topSubtitle}>
                        {(item.category || "Sin categoría")} · {formatNumber(item.count)} ({item.percentage.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.helpText}>Aún no hay actividades registradas en este rango.</Text>
              )}
            </View>
            <View style={styles.categorySection}>
              <Text style={styles.subSectionTitle}>Categorías destacadas</Text>
              {categoryItems.length ? (
                categoryItems.map((item) => (
                  <View key={item.category} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{item.category}</Text>
                    <View style={styles.categoryBar}>
                      <View style={[styles.categoryBarFill, { width: `${Math.min(100, item.percentage)}%` }]} />
                    </View>
                    <Text style={styles.categoryValue}>{item.percentage.toFixed(1)}%</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.helpText}>Sin actividades clasificadas en este rango.</Text>
              )}
            </View>
          </>
        ) : (
          !statsError && !statsLoading ? <Text style={styles.helpText}>Aplica un rango para ver métricas.</Text> : null
        )}
      </View>
    );
  }, [applyStatsFilters, clearStatsFilters, isAdmin, stats, statsError, statsFilterError, statsFilters.endDate, statsFilters.startDate, statsLoading]);

  const filtersListHeader = useMemo(() => {
    if (!isAdmin) return null;
    return (
      <View>
        <View style={styles.viewHeader}>
          <TouchableOpacity style={styles.backRow} onPress={() => setActiveView("menu")} accessibilityRole="button">
            <Text style={styles.backText}>{"< Opciones"}</Text>
          </TouchableOpacity>
          <Text style={styles.viewTitle}>Filtrado por uso</Text>
          <Text style={styles.viewSubtitle}>Revisa usuarios registrados y su estado según el rango que definas.</Text>
        </View>
        {userFiltersHeader}
      </View>
    );
  }, [isAdmin, setActiveView, userFiltersHeader]);

  const renderUser = useCallback(({ item }: { item: AdminUser }) => {
    const badge = statusBadge(item.status);
    const lastActivity = item.last_activity_at ? formatDateTime(item.last_activity_at) : null;

    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.full_name || "Sin nombre"}</Text>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.timestamp}>
            {lastActivity ? `Últ. actividad: ${lastActivity}` : `Registro: ${formatDateTime(item.created_at)}`}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
    );
  }, []);

  if (!accessChecked) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
        <Text style={styles.centerText}>Comprobando permisos…</Text>
      </View>
    );
  }

  if (accessChecked && accessError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedEmoji}>⚠️</Text>
        <Text style={[styles.centerText, { fontWeight: "700" }]}>No se pudo verificar</Text>
        <Text style={[styles.centerText, { color: theme.muted, textAlign: "center" }]}>{accessError}</Text>
        <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn, styles.retryBtn]} onPress={() => { void verifyAccessAndLoad(); }}>
          <Text style={styles.actionBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (accessChecked && !isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.deniedEmoji}>🔒</Text>
        <Text style={[styles.centerText, { fontWeight: "700" }]}>Acceso restringido</Text>
        <Text style={[styles.centerText, { color: theme.muted, textAlign: "center" }]}>
          Esta sección es solo para administradores. Si necesitas acceso, contacta al equipo de JubilApp.
        </Text>
      </View>
    );
  }

  if (activeView === "menu") {
    return (
      <View style={[styles.container, styles.menuWrapper]}>
        <View style={styles.menuIntro}>
          <Text style={styles.sectionTitle}>Panel administrador</Text>
          <Text style={styles.helpText}>Elige qué herramienta quieres revisar.</Text>
        </View>
        <TouchableOpacity
          style={styles.selectionCard}
          onPress={() => setActiveView("filters")}
          accessibilityRole="button"
        >
          <Text style={styles.selectionTag}>Usuarios</Text>
          <Text style={styles.selectionTitle}>Filtrado por uso</Text>
          <Text style={styles.selectionSubtitle}>
            Consulta la lista de usuarios registrados y aplica rangos de fechas para analizar su actividad.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.selectionCard}
          onPress={() => setActiveView("stats")}
          accessibilityRole="button"
        >
          <Text style={styles.selectionTag}>Estadísticas</Text>
          <Text style={styles.selectionTitle}>Estadísticas de uso</Text>
          <Text style={styles.selectionSubtitle}>
            Visualiza DAU, MAU, actividades destacadas y categorías con filtros flexibles.
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activeView === "stats") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.statsScroll}>
        <View style={styles.viewHeader}>
          <TouchableOpacity style={styles.backRow} onPress={() => setActiveView("menu")} accessibilityRole="button">
            <Text style={styles.backText}>{"< Opciones"}</Text>
          </TouchableOpacity>
          <Text style={styles.viewTitle}>Estadísticas de uso</Text>
          <Text style={styles.viewSubtitle}>Selecciona un rango de fechas para revisar DAU/MAU y las métricas clave.</Text>
        </View>
        {statsPanel}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {loading && users.length === 0 ? (
        <View style={styles.loadingLayer}>
          <ActivityIndicator color={theme.primary} />
          <Text style={styles.centerText}>Cargando usuarios…</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={renderUser}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={filtersListHeader ?? undefined}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} colors={[theme.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.centerText}>No hay usuarios para los filtros seleccionados.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  filters: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: theme.bg,
  },
  statsPanel: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: theme.bg,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: theme.text, marginBottom: 4 },
  helpText: { color: theme.muted, marginBottom: 12 },
  filterRow: { flexDirection: "row", gap: 12 },
  label: { fontSize: 14, fontWeight: "600", color: theme.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  filterError: { color: theme.danger, marginTop: 8 },
  actions: { flexDirection: "row", marginTop: 16 },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radius,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 16, fontWeight: "700" },
  primaryBtn: { backgroundColor: theme.primary },
  secondaryBtn: { backgroundColor: "#4B5563" },
  outlineBtn: { borderWidth: 1, borderColor: theme.border, backgroundColor: "#fff" },
  outlineBtnText: { color: theme.text },
  retryBtn: { width: "70%", alignSelf: "center", marginTop: 16, flex: 0 },
  noticeBox: {
    padding: 12,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  noticeTitle: { fontWeight: "700", color: theme.text, marginBottom: 4 },
  noticeText: { color: theme.muted, fontSize: 13, lineHeight: 18 },
  statsLoadingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  loadingHint: { color: theme.muted },
  meta: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaText: { color: theme.muted },
  metaStrong: { color: theme.text, fontWeight: "700" },
  metaChip: {
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
  },
  statusHint: { marginTop: 8, color: theme.muted, fontSize: 12 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  metricCard: {
    flexBasis: "48%",
    backgroundColor: "#fff",
    borderRadius: theme.radius,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  metricLabel: { color: theme.muted, fontSize: 12, fontWeight: "600" },
  metricValue: { fontSize: 22, fontWeight: "800", color: theme.text, marginTop: 4 },
  metricHint: { color: theme.muted, fontSize: 12, marginTop: 2 },
  dailyPanel: { marginTop: 20 },
  subSectionTitle: { fontSize: 16, fontWeight: "700", color: theme.text, marginBottom: 8 },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barColumn: { alignItems: "center", flex: 1 },
  barValue: { width: 12, borderRadius: 6, backgroundColor: theme.primary },
  barLabel: { fontSize: 10, color: theme.muted, marginTop: 4 },
  topSection: { marginTop: 20 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  topRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  topRankText: { color: "#0369A1", fontWeight: "700" },
  topTitle: { color: theme.text, fontWeight: "700" },
  topSubtitle: { color: theme.muted, fontSize: 12 },
  categorySection: { marginTop: 16 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  categoryName: { flex: 1, color: theme.text },
  categoryBar: { flex: 2, height: 6, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden" },
  categoryBarFill: { height: "100%", backgroundColor: theme.primary },
  categoryValue: { width: 60, textAlign: "right", color: theme.muted, fontWeight: "600" },
  row: {
    marginHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: "700", color: theme.text },
  email: { fontSize: 14, color: theme.muted },
  timestamp: { marginTop: 4, color: theme.muted, fontSize: 13 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  separator: { height: 1, backgroundColor: "#E5E7EB" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: theme.bg,
  },
  centerText: { color: theme.text, fontSize: 16, marginTop: 8 },
  deniedEmoji: { fontSize: 48 },
  loadingLayer: {
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  errorBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    borderRadius: theme.radius,
    backgroundColor: "#FEE2E2",
  },
  errorText: { color: theme.danger },
  empty: { paddingHorizontal: 20, paddingTop: 40 },
  menuWrapper: { paddingHorizontal: 20, paddingTop: 32 },
  menuIntro: { marginBottom: 16 },
  selectionCard: {
    backgroundColor: "#fff",
    borderRadius: theme.radius,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  selectionTag: { fontSize: 12, fontWeight: "700", color: theme.primary, textTransform: "uppercase" },
  selectionTitle: { fontSize: 20, fontWeight: "800", color: theme.text, marginTop: 6 },
  selectionSubtitle: { color: theme.muted, marginTop: 6, lineHeight: 20 },
  viewHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: theme.bg,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backRow: { paddingVertical: 4, marginBottom: 12 },
  backText: { color: theme.primary, fontWeight: "700" },
  viewTitle: { fontSize: 22, fontWeight: "800", color: theme.text },
  viewSubtitle: { marginTop: 4, color: theme.muted },
  statsScroll: { paddingBottom: 32 },
});
