import { View, Text, TouchableOpacity, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { theme } from "../src/lib/theme";
import BottomNav from "../components/BottomNav";
import { fetchProfile } from "../src/api/profile";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Activity = { id: string; title: string; time: string; emoji: string; done: boolean };
type Notif = { id: string; text: string; time: string; read: boolean };

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string | null>(null);
  const [items, setItems] = useState<Activity[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([
    { id: "n1", text: "⏰ ¡Recuerda tu yoga suave a las 10:00!", time: "hoy 09:30", read: false },
    { id: "n2", text: "🌟 Cada día es una nueva oportunidad para aprender.", time: "ayer 18:10", read: false },
    { id: "n3", text: "🎉 Bien hecho, completaste tu primera actividad.", time: "ayer 17:45", read: true },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchProfile();
        setName((p.full_name || p.email || "").toString().split(" ")[0] || null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    // mock sugerencias por ahora
    setItems([
      { id: "1", title: "Yoga suave", time: "10:00", emoji: "🧘", done: false },
      { id: "2", title: "Club de lectura", time: "16:00", emoji: "📚", done: false },
      { id: "3", title: "Pintura creativa", time: "17:30", emoji: "🎨", done: false },
      { id: "4", title: "Caminata ligera", time: "19:00", emoji: "🚶", done: false },
    ]);
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "¡Buenos días";
    if (h < 19) return "¡Buenas tardes";
    return "¡Buenas noches";
  }, []);

  const completed = items.filter(i => i.done).length;
  const unread = notifs.filter(n => !n.read).length;

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, done: !i.done } : i)));
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

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 4 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => toggleItem(item.id)} accessibilityRole="button">
            <View style={[styles.check, item.done && styles.checkDone]}>
              <Text style={{ fontSize: 16 }}>{item.done ? "✅" : "⭕"}</Text>
            </View>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardTime}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

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
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  check: { width: 28, alignItems: "center" },
  checkDone: {},
  emoji: { fontSize: 28 },
  cardTitle: { fontFamily: "MontserratSemiBold", color: theme.text, fontSize: 18 },
  cardTime: { color: "#4B5563", fontFamily: "NunitoRegular", marginTop: 2 },
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
});
