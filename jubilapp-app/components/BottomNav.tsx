import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "../src/lib/theme";

type TabKey = "home" | "calendar" | "community" | "profile";

export default function BottomNav({ active }: { active: TabKey }) {
  const router = useRouter();
  const btn = (key: TabKey, label: string, emoji: string, path: string) => (
    <TouchableOpacity onPress={() => router.replace(path)} style={styles.item} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.icon, active === key && styles.active]}>{emoji}</Text>
      <Text style={[styles.label, active === key && styles.active]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.bar}>
      {btn("home", "Inicio", "🏠", "/home")}
      {btn("calendar", "Calendario", "📅", "/calendar")}
      {btn("community", "Comunidad", "💬", "/community")}
      {btn("profile", "Perfil", "👤", "/profile")}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 20, android: 12, default: 12 }),
    flexDirection: "row",
    justifyContent: "space-around",
  },
  item: { alignItems: "center", gap: 2, paddingHorizontal: 6 },
  icon: { fontSize: 18, color: "#6B7280" },
  label: { fontSize: 12, color: "#6B7280" },
  active: { color: theme.primaryDark },
});

