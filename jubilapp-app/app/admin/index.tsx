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
import {
  createActivity as createCatalogActivity,
  deleteActivity as deleteCatalogActivity,
  fetchActivities as fetchCatalogActivities,
  updateActivity as updateCatalogActivity,
  type CatalogActivity,
} from "../../src/api/activities";
import { theme } from "../../src/lib/theme";

type FilterState = {
  startDate: string;
  endDate: string;
};

type AdminPanelView = "menu" | "filters" | "stats" | "activities";

type ActivityFormState = {
  type: string;
  title: string;
  category: string;
  dateTime: string;
  location: string;
  link: string;
  origin: string;
  tags: string;
};

const EMPTY_FILTERS: FilterState = { startDate: "", endDate: "" };
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_ACTIVITY_FORM: ActivityFormState = {
  type: "",
  title: "",
  category: "",
  dateTime: "",
  location: "",
  link: "",
  origin: "",
  tags: "",
};

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

function activityToFormState(activity: CatalogActivity): ActivityFormState {
  return {
    type: activity.type ?? "",
    title: activity.title ?? "",
    category: activity.category ?? "",
    dateTime: activity.dateTime ?? "",
    location: activity.location ?? "",
    link: activity.link ?? "",
    origin: activity.origin ?? "",
    tags: activity.tags?.join(", ") ?? "",
  };
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
  const [activities, setActivities] = useState<CatalogActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<CatalogActivity | null>(null);
  const [activityForm, setActivityForm] = useState<ActivityFormState>({ ...EMPTY_ACTIVITY_FORM });
  const [activityFormError, setActivityFormError] = useState<string | null>(null);
  const [activitySaving, setActivitySaving] = useState(false);
  const [activityDeleting, setActivityDeleting] = useState(false);
  const [activitySuccess, setActivitySuccess] = useState<string | null>(null);

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

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    setActivitiesError(null);
    try {
      const data = await fetchCatalogActivities({ limit: 50 });
      setActivities(data);
    } catch (e: any) {
      setActivitiesError(e?.message ?? "No se pudo cargar el catálogo de actividades.");
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (!isAdmin || activeView !== "activities") return;
    void loadActivities();
  }, [activeView, isAdmin, loadActivities]);

  useEffect(() => {
    if (!activitySuccess) return;
    const timer = setTimeout(() => setActivitySuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [activitySuccess]);

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

  const resetActivityForm = useCallback(() => {
    setEditingActivity(null);
    setActivityForm({ ...EMPTY_ACTIVITY_FORM });
    setActivityFormError(null);
  }, []);

  const handleEditActivity = useCallback((activity: CatalogActivity) => {
    setEditingActivity(activity);
    setActivityForm(activityToFormState(activity));
    setActivityFormError(null);
  }, []);

  const handleActivitySubmit = useCallback(async () => {
    const required: (keyof ActivityFormState)[] = ["type", "title", "link", "origin"];
    for (const field of required) {
      if (!activityForm[field].trim()) {
        setActivityFormError("Completa los campos obligatorios (tipo, título, origen y enlace).");
        return;
      }
    }

    const normalizeOptional = (value: string) => {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };

    const tags = activityForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const rawDate = activityForm.dateTime.trim();
    let normalizedDate: string | null = null;
    if (rawDate) {
      const isoLike = /^\d{4}-\d{2}-\d{2}T/.test(rawDate) && (rawDate.endsWith("Z") || /[+-]\d{2}:\d{2}$/i.test(rawDate));
      if (isoLike) {
        normalizedDate = rawDate;
      } else {
        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) {
          setActivityFormError("La fecha/hora debe estar en formato ISO (AAAA-MM-DD HH:MM).");
          return;
        }
        normalizedDate = parsed.toISOString();
      }
    }

    const payload = {
      type: activityForm.type.trim(),
      title: activityForm.title.trim(),
      link: activityForm.link.trim(),
      origin: activityForm.origin.trim(),
      category: normalizeOptional(activityForm.category),
      location: normalizeOptional(activityForm.location),
      dateTime: normalizedDate,
      tags,
    };

    setActivitySaving(true);
    setActivityFormError(null);
    try {
      let saved: CatalogActivity;
      if (editingActivity) {
        saved = await updateCatalogActivity(editingActivity.id, payload);
        setEditingActivity(saved);
        setActivityForm(activityToFormState(saved));
        setActivitySuccess("Actividad actualizada.");
      } else {
        saved = await createCatalogActivity(payload);
        setActivitySuccess("Actividad creada.");
        resetActivityForm();
      }
      await loadActivities();
    } catch (e: any) {
      setActivityFormError(e?.message ?? "No se pudo guardar la actividad.");
    } finally {
      setActivitySaving(false);
    }
  }, [activityForm, editingActivity, loadActivities, resetActivityForm]);

  const performDeleteActivity = useCallback(async () => {
    if (!editingActivity) return;
    setActivityDeleting(true);
    setActivityFormError(null);
    try {
      await deleteCatalogActivity(editingActivity.id);
      setActivitySuccess("Actividad eliminada.");
      resetActivityForm();
      await loadActivities();
    } catch (e: any) {
      setActivityFormError(e?.message ?? "No se pudo eliminar la actividad.");
    } finally {
      setActivityDeleting(false);
    }
  }, [editingActivity, loadActivities, resetActivityForm]);

  const confirmDeleteActivity = useCallback(() => {
    if (!editingActivity) return;
    Alert.alert("Eliminar actividad", `¿Seguro que quieres eliminar "${editingActivity.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => {
          void performDeleteActivity();
        },
      },
    ]);
  }, [editingActivity, performDeleteActivity]);

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
        <TouchableOpacity
          style={styles.selectionCard}
          onPress={() => setActiveView("activities")}
          accessibilityRole="button"
        >
          <Text style={styles.selectionTag}>Catálogo</Text>
          <Text style={styles.selectionTitle}>Gestionar actividades</Text>
          <Text style={styles.selectionSubtitle}>
            Agrega o modifica actividades manuales para mantener actualizado el catálogo.
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activeView === "activities") {
    const actorLabel = (actor?: CatalogActivity["createdBy"]) =>
      actor?.name || actor?.email || actor?.uid || undefined;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.activitiesScroll}>
        <View style={styles.viewHeader}>
          <TouchableOpacity style={styles.backRow} onPress={() => setActiveView("menu")} accessibilityRole="button">
            <Text style={styles.backText}>{"< Opciones"}</Text>
          </TouchableOpacity>
          <Text style={styles.viewTitle}>Gestión de actividades</Text>
          <Text style={styles.viewSubtitle}>Crea nuevas actividades o ajusta las existentes en el catálogo.</Text>
        </View>

        <View style={styles.activityFormCard}>
          <View style={styles.activityFormHeader}>
            <Text style={styles.subSectionTitle}>{editingActivity ? "Editar actividad" : "Nueva actividad"}</Text>
            {editingActivity ? (
              <TouchableOpacity onPress={resetActivityForm} accessibilityRole="button">
                <Text style={styles.refreshText}>Crear nueva</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Tipo *</Text>
            <TextInput
              value={activityForm.type}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, type: value }))}
              placeholder="atemporal, evento…"
              style={styles.input}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              value={activityForm.title}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, title: value }))}
              placeholder="Nombre de la actividad"
              style={styles.input}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Origen *</Text>
            <TextInput
              value={activityForm.origin}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, origin: value }))}
              placeholder="catalogo-interno, chilecultura…"
              style={styles.input}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Enlace *</Text>
            <TextInput
              value={activityForm.link}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, link: value }))}
              placeholder="https://…"
              style={styles.input}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Categoría</Text>
            <TextInput
              value={activityForm.category}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, category: value }))}
              placeholder="Bienestar, Cultura…"
              style={styles.input}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Ubicación</Text>
            <TextInput
              value={activityForm.location}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, location: value }))}
              placeholder="Dirección o comuna"
              style={styles.input}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Fecha y hora</Text>
            <TextInput
              value={activityForm.dateTime}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, dateTime: value }))}
              placeholder="2024-05-01T18:00:00Z"
              style={styles.input}
              autoCapitalize="none"
            />
            <Text style={styles.activityHint}>ISO completo o “AAAA-MM-DD HH:MM”. Se guarda en UTC.</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.label}>Tags</Text>
            <TextInput
              value={activityForm.tags}
              onChangeText={(value) => setActivityForm((prev) => ({ ...prev, tags: value }))}
              placeholder="Bienestar, Tecnología"
              style={styles.input}
              autoCapitalize="none"
            />
            <Text style={styles.activityHint}>Separadas por coma. Deben coincidir con el catálogo de intereses.</Text>
          </View>
          {activityFormError ? <Text style={styles.formError}>{activityFormError}</Text> : null}
          {activitySuccess ? <Text style={styles.successText}>{activitySuccess}</Text> : null}
          <View style={styles.activityActions}>
            {editingActivity ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn]}
                onPress={confirmDeleteActivity}
                disabled={activitySaving || activityDeleting}
                accessibilityRole="button"
              >
                {activityDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Eliminar</Text>
                )}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={() => {
                void handleActivitySubmit();
              }}
              disabled={activitySaving}
              accessibilityRole="button"
            >
              {activitySaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                  {editingActivity ? "Actualizar" : "Crear"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.activityListSection}>
          <View style={styles.activityListHeader}>
            <Text style={styles.subSectionTitle}>Actividades recientes</Text>
            <TouchableOpacity onPress={() => { void loadActivities(); }} accessibilityRole="button">
              <Text style={styles.refreshText}>Recargar</Text>
            </TouchableOpacity>
          </View>
          {activitiesError ? (
            <View style={[styles.errorBox, { marginHorizontal: 0 }]}>
              <Text style={styles.errorText}>{activitiesError}</Text>
            </View>
          ) : null}
          {activitiesLoading ? (
            <View style={styles.loadingLayer}>
              <ActivityIndicator color={theme.primary} />
              <Text style={styles.centerText}>Cargando actividades…</Text>
            </View>
          ) : null}
          {!activitiesLoading && activities.length === 0 ? (
            <Text style={styles.helpText}>Aún no hay actividades agregadas manualmente.</Text>
          ) : null}
          {activities.map((item) => {
            const createdByLabel = actorLabel(item.createdBy);
            const updatedByLabel = actorLabel(item.updatedBy);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.activityCard, editingActivity?.id === item.id && styles.activityCardActive]}
                onPress={() => handleEditActivity(item)}
                accessibilityRole="button"
              >
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityMeta}>{item.type} · {item.origin}</Text>
                {item.category ? <Text style={styles.activityMeta}>Categoría: {item.category}</Text> : null}
                {item.location ? <Text style={styles.activityMeta}>Ubicación: {item.location}</Text> : null}
                {item.dateTime ? <Text style={styles.activityMeta}>Fecha: {formatDateTime(item.dateTime)}</Text> : null}
                <Text style={styles.activityMeta}>Creada {formatDateTime(item.createdAt)}</Text>
                {createdByLabel ? <Text style={styles.actorText}>Por {createdByLabel}</Text> : null}
                {item.updatedAt ? (
                  <Text style={styles.activityMeta}>
                    Actualizada {formatDateTime(item.updatedAt)}
                    {updatedByLabel ? ` · ${updatedByLabel}` : ""}
                  </Text>
                ) : null}
                {item.tags?.length ? (
                  <View style={styles.tagChipRow}>
                    {item.tags.slice(0, 6).map((tag) => (
                      <View key={`${item.id}-${tag}`} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{tag}</Text>
                      </View>
                    ))}
                    {item.tags.length > 6 ? (
                      <Text style={styles.activityMeta}>+{item.tags.length - 6} más</Text>
                    ) : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
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
  activitiesScroll: { paddingBottom: 32 },
  activityFormCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: theme.radius,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.border,
  },
  activityFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  formField: { marginBottom: 12 },
  activityHint: { color: theme.muted, fontSize: 12, marginTop: 4 },
  refreshText: { color: theme.primary, fontWeight: "700" },
  formError: { color: theme.danger, marginTop: 8 },
  successText: { color: "#0F9D58", marginTop: 8, fontWeight: "700" },
  activityActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  dangerBtn: { backgroundColor: theme.danger },
  activityListSection: { paddingHorizontal: 20, paddingBottom: 32 },
  activityListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activityCard: {
    backgroundColor: "#fff",
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 12,
  },
  activityCardActive: { borderColor: theme.primary },
  activityTitle: { fontSize: 16, fontWeight: "700", color: theme.text },
  activityMeta: { color: theme.muted, fontSize: 13, marginTop: 4 },
  actorText: { color: theme.muted, fontSize: 12, marginTop: 2 },
  tagChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChip: { backgroundColor: "#E0F2FE", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagChipText: { fontSize: 12, color: "#0369A1" },
});
