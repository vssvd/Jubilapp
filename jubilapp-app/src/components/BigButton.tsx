import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

type Props = { title: string; onPress: () => void; disabled?: boolean };

export default function BigButton({ title, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        pressed && { opacity: 0.85 },
        disabled && { backgroundColor: theme.primaryDark, opacity: 0.6 },
      ]}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.radius,
    alignItems: "center",
    marginTop: 8,
  },
  text: { color: "white", fontSize: 18, fontWeight: "700", letterSpacing: 0.3 },
});
