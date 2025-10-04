import { View, Text, TouchableOpacity, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "../src/lib/theme";
import BottomNav from "../components/BottomNav";
import { fetchProfile } from "../src/api/profile";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchAtemporalRecommendations } from "../src/api/recommendations";
import {
  fetchUpcomingEvents,
  ActivityEvent,
  createHistoryEntry,
  deleteHistoryEntry,
  fetchActivityHistory,
  ActivityHistoryEntry,
} from "../src/api/activities";

type Activity = {
  id: string;
  title: string;
  emoji: string;
  done: boolean;
  isFallback?: boolean;
  category?: string | null;
  tags?: string[] | null;
  historyId?: string | null;
  pending?: boolean;
};
type Notif = { id: string; text: string; time: string; read: boolean };

function formatEventDateTime(value?: string | null): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;

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

function describeEventLocation(value?: string | null): string {
  if (!value) return "Lugar por confirmar";
  const trimmed = value.trim();
  if (!trimmed) return "Lugar por confirmar";

  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const main = parts[0];
    const city = parts[parts.length - 1];
    if (main.toLowerCase() === city.toLowerCase()) {
      return city;
    }
    return `${main} · ${city}`;
  }

  return trimmed;
}

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams<{ onboard?: string }>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string | null>(null);
  const [items, setItems] = useState<Activity[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([
    { id: "n1", text: "⏰ ¡Recuerda tu yoga suave a las 10:00!", time: "hoy 09:30", read: false },
    { id: "n2", text: "🌟 Cada día es una nueva oportunidad para aprender.", time: "ayer 18:10", read: false },
    { id: "n3", text: "🎉 Bien hecho, completaste tu primera actividad.", time: "ayer 17:45", read: true },
  ]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [eventItems, setEventItems] = useState<ActivityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const startGenerating = useRef(params.onboard === "1");
  const lastLoadedDate = useRef<string | null>(null);
  const LOADING_SENTINEL = "__loading__";
  const [generationStage, setGenerationStage] = useState<"idle" | "loading" | "ready">(
    startGenerating.current ? "loading" : "idle",
  );

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchProfile();
        setName((p.full_name || p.email || "").toString().split(" ")[0] || null);
      } catch {}
    })();
  }, []);

  const fetchTodayHistory = useCallback(async (): Promise<ActivityHistoryEntry[]> => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return fetchActivityHistory({
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      limit: 200,
    });
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoadingActivities(true);
    lastLoadedDate.current = LOADING_SENTINEL;
    let succeeded = false;
    try {
      const recs = await fetchAtemporalRecommendations(6);
      let todayHistory: ActivityHistoryEntry[] = [];
      try {
        todayHistory = await fetchTodayHistory();
      } catch {
        todayHistory = [];
      }

      const historyByActivity = new Map<string, ActivityHistoryEntry>();
      todayHistory.forEach(entry => {
        if (entry.activityId) {
          historyByActivity.set(entry.activityId, entry);
        }
      });

      setItems(
        recs.map((activity) => {
          const key = String(activity.id);
          const matched = historyByActivity.get(key);
          return {
            id: key,
            title: activity.title,
            emoji: activity.emoji || "🌟",
            done: Boolean(matched),
            isFallback: activity.is_fallback ?? false,
            category: activity.category ?? null,
            tags: activity.tags ?? null,
            historyId: matched?.id ?? null,
            pending: false,
          };
        }),
      );
      succeeded = true;
    } catch {
      Alert.alert("Rutina", "No pudimos cargar tus recomendaciones. Inténtalo nuevamente en unos minutos.");
      setItems([]);
    } finally {
      setLoadingActivities(false);
      lastLoadedDate.current = succeeded ? new Date().toDateString() : null;
      if (startGenerating.current) {
        if (succeeded) {
          setTimeout(() => setGenerationStage("ready"), 600);
        } else {
          setGenerationStage("idle");
          startGenerating.current = false;
        }
      }
    }
  }, [fetchTodayHistory]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useFocusEffect(
    useCallback(() => {
      const todayKey = new Date().toDateString();
      if (lastLoadedDate.current === LOADING_SENTINEL) {
        return;
      }
      if (!lastLoadedDate.current || lastLoadedDate.current !== todayKey) {
        loadSuggestions();
      }
    }, [loadSuggestions]),
  );

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      setLoadingEvents(true);
      setEventsError(null);
      try {
        const data = await fetchUpcomingEvents({ limit: 5, matchMyInterests: true, daysAhead: 45 });
        if (!cancelled) {
          setEventItems(data);
        }
      } catch {
        if (!cancelled) {
          setEventItems([]);
          setEventsError("No pudimos cargar tus eventos. Inténtalo nuevamente en unos minutos.");
        }
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      }
    };

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "¡Buenos días";
    if (h < 19) return "¡Buenas tardes";
    return "¡Buenas noches";
  }, []);

  const completed = items.filter(i => i.done).length;
  const unread = notifs.filter(n => !n.read).length;

  const toggleItem = async (id: string) => {
    const current = items.find(i => i.id === id);
    if (!current) return;
    if (current.pending) return;
    if (current.isFallback) return;

    const markAsDone = !current.done;

    if (markAsDone) {
      setItems(prev => prev.map(i => (i.id === id ? { ...i, done: true, pending: true } : i)));
      try {
        const entry = await createHistoryEntry({
          activityId: current.id,
          title: current.title,
          emoji: current.emoji,
          category: current.category ?? null,
          type: "atemporal",
          origin: "rutina-diaria",
          completedAt: new Date().toISOString(),
          tags: current.tags ?? null,
        });
        setItems(prev => prev.map(i => (i.id === id ? { ...i, historyId: entry.id, pending: false, done: true } : i)));
      } catch {
        setItems(prev => prev.map(i => (i.id === id ? { ...i, done: false, pending: false } : i)));
        Alert.alert("Historial", "No pudimos registrar la actividad. Inténtalo nuevamente.");
      }
    } else {
      const historyId = current.historyId;
      setItems(prev => prev.map(i => (i.id === id ? { ...i, done: false, pending: true } : i)));
      try {
        if (historyId) {
          await deleteHistoryEntry(historyId);
        }
        setItems(prev => prev.map(i => (i.id === id ? { ...i, historyId: null, pending: false, done: false } : i)));
      } catch {
        setItems(prev => prev.map(i => (i.id === id ? { ...i, done: true, pending: false } : i)));
        Alert.alert("Historial", "No pudimos actualizar el historial. Inténtalo nuevamente.");
      }
    }
  };

  const openEventLink = useCallback((url: string) => {
    if (!url) {
      Alert.alert("Eventos", "Este evento aún no tiene un enlace disponible.");
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert("Eventos", "No pudimos abrir el enlace del evento.");
    });
  }, []);

  const handleContinue = () => {
    startGenerating.current = false;
    setGenerationStage("idle");
    if (params.onboard === "1") {
      router.replace("/home");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 108 }]}>
      <View style={styles.header}>
        <Text style={styles.appName}>JubilApp</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={() => setShowNotif(true)} accessibilityLabel="Abrir notificaciones" accessibilityRole="button">
            <View>
              <Text style={styles.bell}>🔔</Text>
              {unread > 0 && <View style={styles.badge} />}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.greeting, { textAlign: "center" }]}>
        👋 {greeting}{name ? `, ${name}` : ""}!
      </Text>
      <Text style={[styles.subtitle, { textAlign: "center", marginBottom: 6 }]}>Estas son tus actividades de hoy</Text>

      <View style={styles.eventsSection}>
        <Text style={styles.sectionTitle}>Eventos recomendados</Text>
        {loadingEvents ? (
          <View style={[styles.eventsCard, styles.eventsCenteredCard]}>
            <ActivityIndicator color={theme.primary} size="small" />
            <Text style={styles.eventsLoadingText}>Buscando eventos…</Text>
          </View>
        ) : eventsError ? (
          <View style={[styles.eventsCard, styles.eventsCenteredCard]}>
            <Text style={styles.eventsError}>{eventsError}</Text>
          </View>
        ) : eventItems.length === 0 ? (
          <View style={[styles.eventsCard, styles.eventsCenteredCard]}>
            <Text style={styles.eventsEmpty}>No encontramos eventos próximos según tus intereses.</Text>
          </View>
        ) : (
          eventItems.map((event) => {
            const formattedDate = formatEventDateTime(event.dateTime) ?? "Fecha por definir";
            const locationLabel = describeEventLocation(event.location);
            return (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventsCard, styles.eventCard]}
                onPress={() => openEventLink(event.link)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir evento ${event.title}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventMeta}>🗓️ {formattedDate}</Text>
                  <Text style={styles.eventMeta}>📍 {locationLabel}</Text>
                </View>
                <Text style={styles.eventLinkText}>Ver</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {loadingActivities ? (
        <View style={styles.listLoading}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={styles.loadingText}>Preparando tus recomendaciones…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 4 }}
          ListEmptyComponent={(
            <Text style={styles.emptyState}>
              Aún no tenemos actividades para mostrar. Ajusta tus intereses o inténtalo más tarde.
            </Text>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.isFallback ? styles.cardFallback : undefined]}
              onPress={() => toggleItem(item.id)}
              accessibilityRole="button"
              disabled={item.isFallback || item.pending}
            >
              <View style={[styles.check, item.done && styles.checkDone, item.pending && styles.checkPending]}>
                {item.pending ? (
                  <ActivityIndicator size="small" color={item.done ? "#FFFFFF" : "#0f766e"} />
                ) : (
                  <Text style={{ fontSize: 16 }}>{item.done ? "✅" : "⭕"}</Text>
                )}
              </View>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!item.isFallback && item.category && (
                  <Text style={styles.categoryPill}>🎯 {item.category}</Text>
                )}
                {item.isFallback && (
                  <Text style={styles.fallbackText}>Agrega más intereses para recibir ideas nuevas.</Text>
                )}
                {item.isFallback && (
                  <TouchableOpacity
                    style={styles.fallbackButton}
                    onPress={() => router.push("/interests")}
                    accessibilityRole="button"
                    accessibilityLabel="Editar intereses"
                  >
                    <Text style={styles.fallbackButtonText}>Editar intereses</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Text style={styles.progress}>Has completado {completed} de {items.length} actividades hoy 🎉</Text>

      <BottomNav active="home" />

      {showNotif && (
        <Pressable style={styles.overlay} onPress={() => setShowNotif(false)}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notificaciones</Text>
              <TouchableOpacity onPress={() => setShowNotif(false)} accessibilityLabel="Cerrar" accessibilityRole="button">
                <Text style={styles.closeBtn}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 8 }} />
            {notifs.map(n => (
              <TouchableOpacity key={n.id} style={styles.notifRow} onPress={() => setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}>
                <View style={[styles.dot, !n.read ? styles.dotUnread : undefined]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifText}>{n.text}</Text>
                  <Text style={styles.notifTime}>{n.time}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setNotifs(prev => prev.map(x => ({ ...x, read: true })))} style={{ alignSelf: "flex-end", marginTop: 6 }}>
              <Text style={styles.markAll}>Marcar todo como leído</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      )}

      {generationStage !== "idle" && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            {generationStage === "loading" ? (
              <>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={styles.overlayTitle}>Generando rutina personalizada…</Text>
                <Text style={styles.overlaySubtitle}>
                  Analizando tus intereses y nivel de preparación.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.overlayEmoji}>✅</Text>
                <Text style={styles.overlayTitle}>¡Rutina personalizada lista!</Text>
                <Text style={styles.overlaySubtitle}>Tenemos actividades pensadas especialmente para ti.</Text>
                <TouchableOpacity style={styles.overlayButton} onPress={handleContinue}>
                  <Text style={styles.overlayButtonText}>Continuar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  appName: { color: theme.text, fontFamily: "MontserratSemiBold", fontSize: 20 },
  bell: { fontSize: 24 },
  badge: { position: "absolute", top: 0, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  greeting: { fontFamily: "MontserratSemiBold", color: "#111827", fontSize: 24, marginTop: 8 },
  subtitle: { color: "#4B5563", fontFamily: "NunitoRegular", marginTop: 4 },
  sectionTitle: { fontFamily: "MontserratSemiBold", color: theme.text, fontSize: 18, marginBottom: 8 },
  eventsSection: { marginTop: 18 },
  eventsCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, marginBottom: 10 },
  eventsCenteredCard: { alignItems: "center", justifyContent: "center", gap: 8 },
  eventsLoadingText: { color: "#4B5563", fontFamily: "NunitoRegular" },
  eventsError: { color: "#B91C1C", fontFamily: "NunitoRegular", textAlign: "center" },
  eventsEmpty: { color: "#4B5563", fontFamily: "NunitoRegular", textAlign: "center" },
  eventCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  eventTitle: { fontFamily: "MontserratSemiBold", color: theme.text, fontSize: 17, marginBottom: 4 },
  eventMeta: { fontFamily: "NunitoRegular", color: "#4B5563", fontSize: 14, marginBottom: 2 },
  eventLinkText: { fontFamily: "MontserratSemiBold", color: theme.primary, alignSelf: "center" },
  listLoading: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 32 },
  loadingText: { marginTop: 12, color: "#4B5563", fontFamily: "NunitoRegular" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  cardFallback: { backgroundColor: "#FFFBEB", borderColor: "#FBBF24" },
  check: { width: 28, alignItems: "center", justifyContent: "center" },
  checkDone: {},
  checkPending: { opacity: 0.8 },
  emoji: { fontSize: 28 },
  cardTitle: { fontFamily: "MontserratSemiBold", color: theme.text, fontSize: 18 },
  categoryPill: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    color: "#4B5563",
    fontFamily: "NunitoRegular",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 13,
  },
  fallbackText: { color: "#92400e", fontFamily: "NunitoRegular", marginTop: 4 },
  fallbackButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#F59E0B",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fallbackButtonText: { color: "#fff", fontFamily: "MontserratSemiBold", fontSize: 14 },
  emptyState: { textAlign: "center", color: "#4B5563", fontFamily: "NunitoRegular", paddingVertical: 40, paddingHorizontal: 16 },
  progress: { textAlign: "center", marginTop: 8, marginBottom: 6, color: "#065f46", fontFamily: "NunitoRegular" },
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.15)", justifyContent: "flex-start", alignItems: "center" },
  panel: { marginTop: 80, backgroundColor: "#fff", borderRadius: 16, padding: 14, width: "92%", borderWidth: 1, borderColor: "#E5E7EB" },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { fontFamily: "MontserratSemiBold", fontSize: 18, color: theme.text },
  closeBtn: { color: "#2563EB", textDecorationLine: "underline" },
  notifRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  notifText: { color: theme.text, fontFamily: "NunitoRegular" },
  notifTime: { color: "#6B7280", fontFamily: "NunitoRegular", fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D1D5DB" },
  dotUnread: { backgroundColor: "#10B981" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    width: "85%",
    maxWidth: 360,
    alignItems: "center",
    gap: 16,
  },
  overlayEmoji: { fontSize: 38 },
  overlayTitle: { fontFamily: "MontserratSemiBold", fontSize: 20, textAlign: "center", color: theme.text },
  overlaySubtitle: { textAlign: "center", color: "#4B5563", fontFamily: "NunitoRegular" },
  overlayButton: {
    marginTop: 4,
    backgroundColor: theme.primary,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  overlayButtonText: { color: "#fff", fontFamily: "MontserratSemiBold", fontSize: 16 },
});
