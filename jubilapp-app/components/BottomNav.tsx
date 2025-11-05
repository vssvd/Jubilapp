import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter, type Href } from "expo-router";
import { theme } from "../src/lib/theme";

type TabKey = "home" | "favorites" | "history" | "profile";

const TAB_ROUTES = {
  home: "/home",
  favorites: "/favorites",
  history: "/history",
  profile: "/profile",
} satisfies Record<TabKey, Href>;

export default function BottomNav({ active }: { active: TabKey }) {
  const router = useRouter();
  const btn = (key: TabKey, label: string, emoji: string) => (
    <TouchableOpacity
      key={key}
      onPress={() => {
        if (active !== key) {
          router.navigate(TAB_ROUTES[key]);
        }
      }}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.icon, active === key && styles.active]}>{emoji}</Text>
      <Text style={[styles.label, active === key && styles.active]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.bar}>
      {btn("home", "Inicio", "🏠")}
      {btn("favorites", "Favoritos", "⭐")}
      {btn("history", "Historial", "📘")}
      {btn("profile", "Perfil", "👤")}
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
    paddingTop: 12,
    paddingBottom: Platform.select({ ios: 28, android: 18, default: 18 }),
    flexDirection: "row",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 3,
  },
  item: { alignItems: "center", gap: 4, paddingHorizontal: 6 },
  icon: { fontSize: 22, color: "#6B7280" },
  label: { fontSize: 13, color: "#6B7280" },
  active: { color: theme.primaryDark },
});
