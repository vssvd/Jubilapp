import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../src/lib/theme";
import BottomNav from "../components/BottomNav";

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📅 Calendario</Text>
      <Text style={styles.subtitle}>Vista semanal/mensual próximamente.</Text>
      <BottomNav active="calendar" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 16, paddingBottom: 92 },
  title: { fontFamily: "MontserratSemiBold", fontSize: 24, color: theme.text },
  subtitle: { marginTop: 8, color: "#4B5563", fontFamily: "NunitoRegular" },
});

