import { View, Text, TouchableOpacity, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Linking, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform } from "react-native";
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
  FetchUpcomingEventsOptions,
  createHistoryEntry,
  deleteHistoryEntry,
  fetchActivityHistory,
  ActivityHistoryEntry,
  createFavorite,
  deleteFavorite,
  createActivityReport,
  submitHistoryFeedback,
} from "../src/api/activities";

type Activity = {
  id: string;
  activityType: string;
  domainId: number | null;
  title: string;
  emoji: string;
  done: boolean;
  isFallback?: boolean;
  category?: string | null;
  tags?: string[] | null;
  accessibilityLabels?: string[] | null;
  historyId?: string | null;
  pending?: boolean;
  favorite: boolean;
  favoritePending: boolean;
  favoriteKey: string;
  feedbackRating?: number | null;
  feedbackComment?: string | null;
};
type Notif = { id: string; text: string; time: string; read: boolean };

const CATEGORY_OPTIONS = [
  { key: "cognitiva", label: "Cognitiva", icon: "🧠" },
  { key: "social", label: "Social", icon: "🤝" },
  { key: "fisica", label: "Física", icon: "💪" },
] as const;

type CategoryOptionKey = (typeof CATEGORY_OPTIONS)[number]["key"];

const SESSION_FILTERS: { categories: CategoryOptionKey[] } = {
  categories: [],
};

const DEFAULT_EVENTS_RADIUS_KM = 20;
const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

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

function formatDistanceKm(value?: number | null): string | null {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return null;
  if (value < 1) {
    const meters = Math.round(value * 1000);
    if (meters <= 0) {
      return "<1 km";
    }
    return `${meters} m`;
  }
  if (value < 10) {
    return `${value.toFixed(1)} km`;
  }
  return `${Math.round(value)} km`;
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
  const [feedbackTarget, setFeedbackTarget] = useState<{ historyId: string; title: string; emoji?: string | null } | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [reportingActivity, setReportingActivity] = useState<Activity | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([
    { id: "n1", text: "⏰ ¡Recuerda tu yoga suave a las 10:00!", time: "hoy 09:30", read: false },
    { id: "n2", text: "🌟 Cada día es una nueva oportunidad para aprender.", time: "ayer 18:10", read: false },
    { id: "n3", text: "🎉 Bien hecho, completaste tu primera actividad.", time: "ayer 17:45", read: true },
  ]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<CategoryOptionKey[]>(() => [...SESSION_FILTERS.categories]);
  const hasCategoryFilter = selectedCategories.length > 0;
  const selectedCategoryLabels = useMemo(
    () => selectedCategories.map(key => CATEGORY_OPTIONS.find(option => option.key === key)?.label || key),
    [selectedCategories],
  );
  const [eventItems, setEventItems] = useState<ActivityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsNotice, setEventsNotice] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [profileLat, setProfileLat] = useState<number | null>(null);
  const [profileLng, setProfileLng] = useState<number | null>(null);
  const startGenerating = useRef(params.onboard === "1");
  const lastLoadedDate = useRef<string | null>(null);
  const LOADING_SENTINEL = "__loading__";
  const [generationStage, setGenerationStage] = useState<"idle" | "loading" | "ready">(
    startGenerating.current ? "loading" : "idle",
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setProfileLoaded(false);
      setLoadingEvents(true);
      setEventsNotice(null);
      setEventsError(null);
      (async () => {
        try {
          const p = await fetchProfile();
          if (!active) return;
          setName((p.full_name || p.email || "").toString().split(" ")[0] || null);
          const cityValue = (p.location_city ?? "").toString().trim();
          setProfileCity(cityValue || null);
          const latValue = typeof p.location_lat === "number" ? p.location_lat : null;
          const lngValue = typeof p.location_lng === "number" ? p.location_lng : null;
          setProfileLat(latValue !== null && Number.isFinite(latValue) ? latValue : null);
          setProfileLng(lngValue !== null && Number.isFinite(lngValue) ? lngValue : null);
        } catch {
          if (!active) return;
        } finally {
          if (active) {
            setProfileLoaded(true);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    SESSION_FILTERS.categories = [...selectedCategories];
  }, [selectedCategories]);

  const toggleCategory = useCallback((key: CategoryOptionKey) => {
    setSelectedCategories(prev => {
      if (prev.includes(key)) {
        return prev.filter(value => value !== key);
      }
      return [...prev, key];
    });
  }, []);

  const clearCategoryFilters = useCallback(() => {
    setSelectedCategories(prev => (prev.length ? [] : prev));
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
      const recs = await fetchAtemporalRecommendations({
        limit: 6,
        categories: selectedCategories,
      });
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
          const numericId = typeof activity.id === "number" ? activity.id : Number(activity.id);
          const domainId = Number.isFinite(numericId) ? numericId : null;
          const favoriteKey = domainId !== null ? `atemporal-${domainId}` : key;
          return {
            id: key,
            activityType: "atemporal",
            domainId,
            title: activity.title,
            emoji: activity.emoji || "🌟",
            done: Boolean(matched),
            isFallback: activity.is_fallback ?? false,
            category: activity.category ?? null,
            tags: activity.tags ?? null,
            accessibilityLabels: activity.accessibility_labels ?? null,
            historyId: matched?.id ?? null,
            pending: false,
            favorite: Boolean(activity.is_favorite),
            favoritePending: false,
            favoriteKey,
            feedbackRating: matched?.rating ?? null,
            feedbackComment: matched?.notes ?? null,
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
  }, [fetchTodayHistory, selectedCategories]);

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
      if (!profileLoaded) {
        return;
      }

      setLoadingEvents(true);
      setEventsError(null);
      setEventsNotice(null);

      const hasCoords =
        typeof profileLat === "number" &&
        Number.isFinite(profileLat) &&
        typeof profileLng === "number" &&
        Number.isFinite(profileLng);
      const hasCity = Boolean(profileCity && profileCity.trim().length);

      if (!hasCoords && !hasCity) {
        if (!cancelled) {
          setEventItems([]);
          setEventsNotice("Agrega tu ciudad o comuna en tu perfil para ver eventos cercanos. Mientras tanto, explora tus actividades atemporales.");
          setLoadingEvents(false);
        }
        return;
      }

      const options: FetchUpcomingEventsOptions = {
        limit: 5,
        matchMyInterests: true,
        daysAhead: 45,
      };

      if (hasCoords && profileLat !== null && profileLng !== null) {
        options.lat = profileLat;
        options.lng = profileLng;
        options.radiusKm = DEFAULT_EVENTS_RADIUS_KM;
      } else if (hasCity && profileCity) {
        options.city = profileCity;
      }

      try {
        const data = await fetchUpcomingEvents(options);
        if (cancelled) return;
        setEventItems(data);
        setEventsNotice(null);
        setEventsError(null);
      } catch (error: any) {
        if (cancelled) return;
        setEventItems([]);
        if (error?.status === 428 || error?.code === "location_required") {
          setEventsNotice("Necesitamos tu ubicación para recomendarte eventos cercanos. Configúrala en tu perfil y prueba nuevamente.");
          setEventsError(null);
        } else {
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
  }, [profileLoaded, profileCity, profileLat, profileLng]);

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
        const rating = typeof entry.rating === "number" ? entry.rating : null;
        const comment = entry.notes ?? null;
        setItems(prev =>
          prev.map(i =>
            i.id === id
              ? {
                  ...i,
                  historyId: entry.id,
                  pending: false,
                  done: true,
                  feedbackRating: rating,
                  feedbackComment: comment,
                }
              : i,
          ),
        );
        if (rating === null) {
          setFeedbackTarget({
            historyId: entry.id,
            title: current.title,
            emoji: current.emoji || "🌟",
          });
          setFeedbackRating(null);
          setFeedbackComment(comment ?? "");
        }
      } catch {
        setItems(prev =>
          prev.map(i =>
            i.id === id
              ? {
                  ...i,
                  historyId: current.historyId ?? null,
                  done: current.done,
                  pending: false,
                  feedbackRating: current.feedbackRating ?? null,
                  feedbackComment: current.feedbackComment ?? null,
                }
              : i,
          ),
        );
        Alert.alert("Historial", "No pudimos registrar la actividad. Inténtalo nuevamente.");
      }
    } else {
      const historyId = current.historyId;
      setItems(prev => prev.map(i => (i.id === id ? { ...i, done: false, pending: true } : i)));
      try {
        if (historyId) {
          await deleteHistoryEntry(historyId);
        }
        setItems(prev =>
          prev.map(i =>
            i.id === id
              ? {
                  ...i,
                  historyId: null,
                  pending: false,
                  done: false,
                  feedbackRating: null,
                  feedbackComment: null,
                }
              : i,
          ),
        );
      } catch {
        setItems(prev =>
          prev.map(i =>
            i.id === id
              ? {
                  ...i,
                  done: true,
                  pending: false,
                  historyId,
                  feedbackRating: current.feedbackRating ?? null,
                  feedbackComment: current.feedbackComment ?? null,
                }
              : i,
          ),
        );
        Alert.alert("Historial", "No pudimos actualizar el historial. Inténtalo nuevamente.");
      }
    }
  };

  const closeFeedbackModal = () => {
    if (feedbackPending) return;
    setFeedbackTarget(null);
    setFeedbackRating(null);
    setFeedbackComment("");
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackTarget) return;
    if (feedbackRating === null) {
      Alert.alert("Feedback", "Selecciona una puntuación entre 1 y 5.");
      return;
    }
    setFeedbackPending(true);
    const trimmedComment = feedbackComment.trim();
    try {
      const updated = await submitHistoryFeedback(feedbackTarget.historyId, {
        rating: feedbackRating,
        comment: trimmedComment ? trimmedComment : null,
      });
      setItems(prev =>
        prev.map(item =>
          item.historyId === updated.id
            ? {
                ...item,
                feedbackRating: typeof updated.rating === "number" ? updated.rating : feedbackRating,
                feedbackComment: updated.notes ?? (trimmedComment ? trimmedComment : null),
              }
            : item,
        ),
      );
      setFeedbackTarget(null);
      setFeedbackRating(null);
      setFeedbackComment("");
    } catch {
      Alert.alert("Feedback", "No pudimos guardar tu feedback. Inténtalo nuevamente.");
    } finally {
      setFeedbackPending(false);
    }
  };

  const toggleFavorite = async (id: string) => {
    const current = items.find(i => i.id === id);
    if (!current) return;
    if (current.isFallback) return;
    if (current.favoritePending) return;

    const prevFavorite = Boolean(current.favorite);
    const nextFavorite = !prevFavorite;

    setItems(prev => prev.map(i => (i.id === id ? { ...i, favorite: nextFavorite, favoritePending: true } : i)));

    try {
      if (nextFavorite) {
        const source = current.domainId !== null
          ? { type: "atemporal", id: current.domainId }
          : { type: "atemporal" };
        await createFavorite({
          activityId: current.favoriteKey,
          activityType: "atemporal",
          title: current.title,
          emoji: current.emoji,
          category: current.category ?? null,
          tags: current.tags ?? undefined,
          source,
        });
      } else {
        await deleteFavorite(current.favoriteKey);
      }
      setItems(prev => prev.map(i => (i.id === id ? { ...i, favorite: nextFavorite, favoritePending: false } : i)));
    } catch {
      setItems(prev => prev.map(i => (i.id === id ? { ...i, favorite: prevFavorite, favoritePending: false } : i)));
      Alert.alert(
        "Favoritos",
        nextFavorite
          ? "No pudimos guardar el favorito. Inténtalo nuevamente."
          : "No pudimos actualizar tus favoritos. Inténtalo nuevamente.",
      );
    }
  };

  const startReport = useCallback((activity: Activity) => {
    setReportPending(false);
    setReportingActivity(activity);
    setReportReason("");
  }, []);

  const closeReportModal = useCallback(() => {
    if (reportPending) return;
    Keyboard.dismiss();
    setReportingActivity(null);
    setReportReason("");
  }, [reportPending]);

  const submitReport = useCallback(async () => {
    if (!reportingActivity || reportPending) return;
    Keyboard.dismiss();
    setReportPending(true);
    const reasonText = reportReason.trim();
    try {
      await createActivityReport({
        activityId: reportingActivity.id,
        activityType: reportingActivity.activityType,
        reason: reasonText.length ? reasonText : undefined,
        title: reportingActivity.title,
        emoji: reportingActivity.emoji,
        category: reportingActivity.category ?? undefined,
      });
      setItems(prev => prev.filter(item => item.id !== reportingActivity.id));
      Alert.alert("Rutina", "Listo, ajustaremos tus sugerencias.");
      setReportingActivity(null);
      setReportReason("");
    } catch (error: any) {
      console.error("createActivityReport failed", error);
      if (error?.data) {
        console.log("createActivityReport error payload", error.data);
      }
      const friendly =
        (typeof error?.data?.detail === "string" && error.data.detail.trim()) ||
        (error?.data?.detail?.message && String(error.data.detail.message).trim()) ||
        (typeof error?.message === "string" && error.message.trim()) ||
        "No pudimos registrar tu preferencia. Inténtalo nuevamente.";
      Alert.alert("Rutina", friendly);
    } finally {
      setReportPending(false);
    }
  }, [reportingActivity, reportPending, reportReason]);

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

      <View style={styles.categorySection}>
        <Text style={styles.categoryLabel}>Filtra tus recomendaciones</Text>
        <View style={styles.categoryChipsRow}>
          <Pressable
            onPress={clearCategoryFilters}
            style={[styles.categoryChip, !hasCategoryFilter && styles.categoryChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: !hasCategoryFilter }}
          >
            <Text style={[styles.categoryChipText, !hasCategoryFilter && styles.categoryChipTextActive]}>✨ Todas</Text>
          </Pressable>
          {CATEGORY_OPTIONS.map(option => {
            const active = selectedCategories.includes(option.key);
            return (
              <Pressable
                key={option.key}
                onPress={() => toggleCategory(option.key)}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {option.icon} {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {hasCategoryFilter && (
          <Text style={styles.categoryHint}>
            Filtro activo: {selectedCategoryLabels.join(", ")}.
          </Text>
        )}
      </View>

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
        ) : eventsNotice ? (
          <View style={[styles.eventsCard, styles.eventsCenteredCard]}>
            <Text style={styles.eventsNotice}>{eventsNotice}</Text>
          </View>
        ) : eventItems.length === 0 ? (
          <View style={[styles.eventsCard, styles.eventsCenteredCard]}>
            <Text style={styles.eventsEmpty}>No encontramos eventos próximos según tus intereses.</Text>
          </View>
        ) : (
          eventItems.map((event) => {
            const formattedDate = formatEventDateTime(event.dateTime) ?? "Fecha por definir";
            const locationLabel = describeEventLocation(event.location);
            const distanceLabel = formatDistanceKm(event.distanceKm);
            const locationLine = distanceLabel ? `${locationLabel} · ${distanceLabel}` : locationLabel;
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
                  <Text style={styles.eventMeta}>📍 {locationLine}</Text>
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
              {hasCategoryFilter
                ? "No encontramos actividades para las categorías seleccionadas. Ajusta el filtro o inténtalo más tarde."
                : "Aún no tenemos actividades para mostrar. Ajusta tus intereses o inténtalo más tarde."}
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
                {!item.isFallback && item.accessibilityLabels?.length ? (
                  <View style={styles.accessibilityRow}>
                    {item.accessibilityLabels.map((label, idx) => (
                      <Text key={`${label}-${idx}`} style={styles.accessibilityBadge}>
                        {label}
                      </Text>
                    ))}
                  </View>
                ) : null}
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
                {!item.isFallback && (
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => startReport(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`No me interesa ${item.title}`}
                  >
                    <Text style={styles.dismissButtonText}>No me interesa</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!item.isFallback && (
                <TouchableOpacity
                  style={[
                    styles.favoriteButton,
                    item.favorite && styles.favoriteButtonActive,
                    item.favoritePending && styles.favoriteButtonDisabled,
                  ]}
                  onPress={() => toggleFavorite(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.favorite ? "Quitar de favoritos" : "Agregar a favoritos"} ${item.title}`}
                  disabled={item.favoritePending}
                >
                  {item.favoritePending ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                  ) : (
                    <Text style={[styles.favoriteIcon, item.favorite && styles.favoriteIconActive]}>
                      {item.favorite ? "★" : "☆"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Text style={styles.progress}>Has completado {completed} de {items.length} actividades hoy 🎉</Text>

      {feedbackTarget && (
        <Modal
          visible
          animationType="fade"
          transparent
          onRequestClose={closeFeedbackModal}
        >
          <KeyboardAvoidingView
            style={styles.feedbackOverlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={insets.top + 40}
          >
            <View style={styles.feedbackOverlayContent}>
              <Pressable
                style={styles.feedbackDismissArea}
                onPress={() => {
                  Keyboard.dismiss();
                  closeFeedbackModal();
                }}
              />
              <Pressable style={styles.feedbackCard} onPress={() => {}}>
                <Text style={styles.feedbackTitle}>¿Cómo te fue con esta actividad?</Text>
                <View style={styles.feedbackActivityChip}>
                  <Text style={styles.feedbackActivityEmoji}>{feedbackTarget.emoji || "🌟"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feedbackActivityTitle}>{feedbackTarget.title}</Text>
                  </View>
                </View>
                <Text style={styles.feedbackHint}>Califica de 1 a 5 estrellas y deja un comentario si quieres.</Text>
                <View style={styles.feedbackStarsRow}>
                  {RATING_OPTIONS.map(value => {
                    const active = feedbackRating !== null && value <= feedbackRating;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => {
                          if (feedbackPending) return;
                          setFeedbackRating(value);
                        }}
                        style={[styles.feedbackStarButton, active && styles.feedbackStarButtonActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: feedbackRating === value }}
                        accessibilityLabel={`Calificar con ${value} estrella${value === 1 ? "" : "s"}`}
                        disabled={feedbackPending}
                      >
                        <Text style={[styles.feedbackStar, active && styles.feedbackStarActive]}>
                          {active ? "★" : "☆"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Comentario opcional…"
                  placeholderTextColor="#9CA3AF"
                  value={feedbackComment}
                  onChangeText={setFeedbackComment}
                  editable={!feedbackPending}
                  multiline
                  maxLength={400}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                />
                <View style={styles.feedbackActions}>
                  <TouchableOpacity
                    onPress={closeFeedbackModal}
                    disabled={feedbackPending}
                    style={styles.feedbackSkip}
                    accessibilityRole="button"
                  >
                    <Text style={styles.feedbackSkipText}>Más tarde</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSubmitFeedback}
                    disabled={feedbackPending || feedbackRating === null}
                    style={[
                      styles.feedbackSubmit,
                      (feedbackPending || feedbackRating === null) && styles.feedbackSubmitDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Enviar feedback"
                  >
                    {feedbackPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.feedbackSubmitText}>Enviar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {reportingActivity && (
        <Modal
          visible
          animationType="fade"
          transparent
          onRequestClose={closeReportModal}
        >
          <KeyboardAvoidingView
            style={styles.reportOverlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={insets.top + 40}
          >
            <View style={styles.reportOverlayContent}>
              <Pressable style={styles.reportDismissArea} onPress={Keyboard.dismiss} />
              <Pressable style={styles.reportCard} onPress={() => {}}>
                  <Text style={styles.reportTitle}>¿No te interesa esta actividad?</Text>
                  <View style={styles.reportActivityChip}>
                    <Text style={styles.reportActivityEmoji}>{reportingActivity.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportActivityTitle}>{reportingActivity.title}</Text>
                      {reportingActivity.category && (
                        <Text style={styles.reportActivityCategory}>{reportingActivity.category}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.reportHint}>Comparte el motivo (opcional). Así afinamos mejor tus recomendaciones.</Text>
                  <TextInput
                    style={styles.reportInput}
                    placeholder="Escribe el motivo aquí…"
                    placeholderTextColor="#9CA3AF"
                    value={reportReason}
                    onChangeText={setReportReason}
                    multiline
                    maxLength={400}
                    editable={!reportPending}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <View style={styles.reportActions}>
                    <TouchableOpacity
                      onPress={closeReportModal}
                      disabled={reportPending}
                      style={styles.reportCancel}
                    >
                      <Text style={styles.reportCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={submitReport}
                      disabled={reportPending}
                      style={[styles.reportSubmit, reportPending && styles.reportSubmitDisabled]}
                      accessibilityRole="button"
                      accessibilityLabel="Enviar motivo de reporte"
                    >
                      {reportPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.reportSubmitText}>No me interesa</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

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
  categorySection: { marginTop: 16, marginBottom: 4 },
  categoryLabel: { fontFamily: "MontserratSemiBold", color: "#4B5563", marginBottom: 8 },
  categoryChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    backgroundColor: "#F9FAFB",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryChipActive: { backgroundColor: "#DCFCE7", borderColor: "#10B981" },
  categoryChipText: { fontFamily: "NunitoRegular", color: "#4B5563", fontSize: 14 },
  categoryChipTextActive: { fontFamily: "MontserratSemiBold", color: "#047857" },
  categoryHint: { marginTop: 8, fontFamily: "NunitoRegular", color: "#047857" },
  sectionTitle: { fontFamily: "MontserratSemiBold", color: theme.text, fontSize: 18, marginBottom: 8 },
  eventsSection: { marginTop: 18 },
  eventsCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, marginBottom: 10 },
  eventsCenteredCard: { alignItems: "center", justifyContent: "center", gap: 8 },
  eventsLoadingText: { color: "#4B5563", fontFamily: "NunitoRegular" },
  eventsError: { color: "#B91C1C", fontFamily: "NunitoRegular", textAlign: "center" },
  eventsEmpty: { color: "#4B5563", fontFamily: "NunitoRegular", textAlign: "center" },
  eventsNotice: { color: "#0F172A", fontFamily: "NunitoRegular", textAlign: "center" },
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
  accessibilityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  accessibilityBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E0F2FE",
    color: "#0C4A6E",
    fontFamily: "NunitoRegular",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dismissButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  dismissButtonText: { color: "#B91C1C", fontFamily: "MontserratSemiBold", fontSize: 13 },
  favoriteButton: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999 },
  favoriteButtonActive: {},
  favoriteButtonDisabled: { opacity: 0.5 },
  favoriteIcon: { fontSize: 22, color: "#D1D5DB" },
  favoriteIconActive: { color: "#F59E0B" },
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
  markAll: { color: theme.primary, fontFamily: "MontserratSemiBold", fontSize: 14 },
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
  reportOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  reportOverlayContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  reportDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  reportCard: {
    width: "94%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 14,
  },
  reportTitle: { fontFamily: "MontserratSemiBold", fontSize: 18, color: theme.text },
  reportHint: { fontFamily: "NunitoRegular", color: "#4B5563" },
  reportInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 100,
    fontFamily: "NunitoRegular",
    fontSize: 15,
    color: theme.text,
    textAlignVertical: "top",
  },
  reportActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 4 },
  reportCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "#E5E7EB" },
  reportCancelText: { fontFamily: "MontserratSemiBold", color: "#374151" },
  reportSubmit: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: "#DC2626" },
  reportSubmitDisabled: { opacity: 0.6 },
  reportSubmitText: { fontFamily: "MontserratSemiBold", color: "#fff" },
  reportActivityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reportActivityEmoji: { fontSize: 28 },
  reportActivityTitle: { fontFamily: "MontserratSemiBold", color: theme.text },
  reportActivityCategory: { fontFamily: "NunitoRegular", color: "#6B7280", marginTop: 2 },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  feedbackOverlayContent: { flex: 1, justifyContent: "center" },
  feedbackDismissArea: { flex: 1 },
  feedbackCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
  },
  feedbackTitle: { fontFamily: "MontserratSemiBold", fontSize: 18, color: theme.text },
  feedbackActivityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  feedbackActivityEmoji: { fontSize: 32 },
  feedbackActivityTitle: { fontFamily: "MontserratSemiBold", color: theme.text },
  feedbackHint: { fontFamily: "NunitoRegular", color: "#4B5563" },
  feedbackStarsRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  feedbackStarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  feedbackStarButtonActive: { borderColor: "#F59E0B", backgroundColor: "#FEF3C7" },
  feedbackStar: { fontSize: 26, color: "#9CA3AF" },
  feedbackStarActive: { color: "#D97706" },
  feedbackInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    fontFamily: "NunitoRegular",
    fontSize: 15,
    color: theme.text,
    textAlignVertical: "top",
  },
  feedbackActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12 },
  feedbackSkip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: "#E5E7EB" },
  feedbackSkipText: { fontFamily: "MontserratSemiBold", color: "#374151" },
  feedbackSubmit: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: theme.primary },
  feedbackSubmitDisabled: { opacity: 0.6 },
  feedbackSubmitText: { fontFamily: "MontserratSemiBold", color: "#fff" },
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
