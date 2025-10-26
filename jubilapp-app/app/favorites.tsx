import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import BottomNav from "../components/BottomNav";
import { theme } from "../src/lib/theme";
import { ActivityFavorite, fetchFavorites, deleteFavorite } from "../src/api/activities";

function formatFavoriteDate(value?: string | null): string | null {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(dt);
  } catch {
    const day = dt.getDate().toString().padStart(2, "0");
    const month = (dt.getMonth() + 1).toString().padStart(2, "0");
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ActivityFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});

  const loadFavorites = useCallback(async ({ withSpinner = true } = {}) => {
    if (withSpinner) {
      setLoading(true);
    }
    try {
      const data = await fetchFavorites();
      setItems(data);
    } catch {
      Alert.alert("Favoritos", "No pudimos cargar tus favoritos. Inténtalo nuevamente en unos minutos.");
    } finally {
      if (withSpinner) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFavorites({ withSpinner: false });
    } finally {
      setRefreshing(false);
    }
  }, [loadFavorites]);

  const handleRemove = async (favorite: ActivityFavorite) => {
    if (pendingMap[favorite.id]) return;
    setPendingMap(prev => ({ ...prev, [favorite.id]: true }));
    try {
      await deleteFavorite(favorite.id);
      setItems(prev => prev.filter(item => item.id !== favorite.id));
    } catch {
      Alert.alert("Favoritos", "No pudimos quitar esta actividad. Inténtalo nuevamente.");
    } finally {
      setPendingMap(prev => {
        const next = { ...prev };
        delete next[favorite.id];
        return next;
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 108 }]}>
      <Text style={styles.title}>Tus favoritos</Text>
      <Text style={styles.subtitle}>Revisa las actividades que guardaste para retomarlas cuando quieras.</Text>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loaderText}>Cargando favoritos…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 4, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={(
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          )}
          renderItem={({ item }) => {
            const removing = Boolean(pendingMap[item.id]);
            const addedOn = formatFavoriteDate(item.createdAt);
            return (
              <View style={styles.card}>
                <Text style={styles.emoji}>{item.emoji || "🌟"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.category && <Text style={styles.cardCategory}>🎯 {item.category}</Text>}
                  {item.tags?.length ? (
                    <Text style={styles.cardTags}>{item.tags.join(" · ")}</Text>
                  ) : null}
                  {addedOn && <Text style={styles.cardDate}>Guardado el {addedOn}</Text>}
                </View>
                <TouchableOpacity
                  onPress={() => handleRemove(item)}
                  style={[styles.removeButton, removing && styles.removeButtonDisabled]}
                  disabled={removing}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${item.title} de tus favoritos`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {removing ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Text style={styles.removeText}>Quitar</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={styles.emptyText}>
                Aún no tienes actividades favoritas. Marca la estrella en tus recomendaciones diarias para guardarlas aquí.
              </Text>
            </View>
          )}
        />
      )}

      <BottomNav active="favorites" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20 },
  title: { fontFamily: "MontserratSemiBold", fontSize: 24, color: theme.text },
  subtitle: { marginTop: 6, fontFamily: "NunitoRegular", color: "#475569" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loaderText: { fontFamily: "NunitoRegular", color: "#6B7280" },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emoji: { fontSize: 30 },
  cardTitle: { fontFamily: "MontserratSemiBold", color: theme.text, fontSize: 18 },
  cardCategory: {
    marginTop: 4,
    fontFamily: "NunitoRegular",
    color: "#047857",
  },
  cardTags: { marginTop: 6, fontFamily: "NunitoRegular", color: "#4B5563" },
  cardDate: { marginTop: 6, fontFamily: "NunitoRegular", color: "#6B7280", fontSize: 13 },
  removeButton: {
    alignSelf: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  removeButtonDisabled: { opacity: 0.6 },
  removeText: { color: "#B91C1C", fontFamily: "MontserratSemiBold", fontSize: 14 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  emptyEmoji: { fontSize: 36 },
  emptyText: { textAlign: "center", fontFamily: "NunitoRegular", color: "#4B5563" },
});
