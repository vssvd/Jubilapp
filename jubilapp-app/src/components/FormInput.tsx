import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

type Props = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  error?: string;
};

export default function FormInput(props: Props) {
  const { label, error } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !!error && { borderColor: theme.danger }]}
        {...props}
      />
      {!!error && <Text style={styles.err}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, marginBottom: 6, color: theme.text, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    backgroundColor: "#FFF",
  },
  err: { color: theme.danger, marginTop: 6, fontSize: 14 },
});
