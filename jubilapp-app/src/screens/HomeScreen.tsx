import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { me, logout, type Me } from "../api/auth";
import BigButton from "../components/BigButton";
import { theme } from "../lib/theme";

export default function HomeScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Me | null>(null);

  const load = async () => {
    try {
      const data = await me();       // ← usa la API correcta
      setProfile(data);
    } catch (e: any) {
      Alert.alert("Sesión", "Vuelve a iniciar sesión.");
      navigation.replace("Login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Hola!</Text>

      {profile && (
        <>
          <Text style={styles.item}>
            UID: <Text style={styles.mono}>{profile.uid}</Text>
          </Text>
          <Text style={styles.item}>Correo: {profile.email ?? "—"}</Text>
          <Text style={styles.item}>Proveedor: {profile.provider ?? "—"}</Text>
        </>
      )}

      <BigButton
        title="Cerrar sesión"
        onPress={async () => {
          await logout();
          navigation.replace("Login");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, padding: 20, backgroundColor: theme.bg },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 16, color: theme.text },
  item: { fontSize: 18, marginBottom: 8, color: theme.text },
  mono: { fontFamily: "Menlo", fontSize: 16 },
});
