import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { fetchAdminStatus, fetchAdminUsers, type AdminUser, type AdminUserFilters } from "../../src/api/admin";
import { theme } from "../../src/lib/theme";

type FilterState = {
  startDate: string;
  endDate: string;
};

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
        await loadUsers({});
      }
    } catch (e: any) {
      setAccessError(e?.message ?? "No se pudo verificar el acceso.");
    } finally {
      setAccessChecked(true);
    }
  }, [loadUsers]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUsers(currentFilters);
    } finally {
      setRefreshing(false);
    }
  }, [loadUsers, currentFilters]);

  const header = useMemo(() => {
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
        ListHeaderComponent={header}
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
  outlineBtn: { borderWidth: 1, borderColor: theme.border, backgroundColor: "#fff" },
  outlineBtnText: { color: theme.text },
  retryBtn: { width: "70%", alignSelf: "center", marginTop: 16, flex: 0 },
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
});
