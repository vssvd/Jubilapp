import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { theme } from "../src/lib/theme";
import BottomNav from "../components/BottomNav";
import { fetchProfile } from "../src/api/profile";

type Activity = { id: string; title: string; time: string; emoji: string; done: boolean };

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [items, setItems] = useState<Activity[]>([]);

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

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>JubilApp</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={() => router.push("/profile")} accessibilityLabel="Abrir ajustes" accessibilityRole="button">
            <Text style={styles.gear}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.greeting}>
        👋 {greeting}{name ? `, ${name}` : ""}!
      </Text>
      <Text style={styles.subtitle}>Estas son tus actividades de hoy</Text>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingVertical: 12 }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 92 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  appName: { color: theme.text, fontFamily: "MontserratSemiBold", fontSize: 20 },
  gear: { fontSize: 24 },
  greeting: { fontFamily: "MontserratSemiBold", color: "#111827", fontSize: 24, marginTop: 6 },
  subtitle: { color: "#4B5563", fontFamily: "NunitoRegular", marginTop: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  check: { width: 28, alignItems: "center" },
  checkDone: {},
  emoji: { fontSize: 28 },
  cardTitle: { fontFamily: "MontserratSemiBold", color: theme.text, fontSize: 18 },
  cardTime: { color: "#4B5563", fontFamily: "NunitoRegular", marginTop: 2 },
  progress: { textAlign: "center", marginTop: 8, color: "#065f46", fontFamily: "NunitoRegular" },
});
