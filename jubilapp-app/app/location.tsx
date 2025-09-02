import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { theme } from "../src/lib/theme";
import { fetchProfile, updateProfile } from "../src/api/profile";

export default function LocationOnboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchProfile();
        setCity((p.location_city ?? "").toString());
        setRegion((p.location_region ?? "").toString());
      } catch {}
      setLoading(false);
    })();
  }, []);

  const saveManual = async () => {
    if (!city.trim()) { Alert.alert("Ubicación", "Ingresa al menos la ciudad/comuna."); return; }
    setSaving(true);
    try {
      await updateProfile({ location_city: city.trim(), location_region: region.trim() || undefined });
      router.replace("/preparation");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo guardar");
    } finally { setSaving(false); }
  };

  const useCurrent = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso", "No pudimos obtener tu ubicación. Puedes ingresarla manualmente.");
        return;
      }
      setSaving(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let newCity = city, newRegion = region;
      try {
        const rr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const a = rr?.[0];
        if (a) {
          newCity = (a.city || a.district || a.subregion || a.name || "").toString();
          newRegion = (a.region || a.subregion || "").toString();
          setCity(newCity);
          setRegion(newRegion);
        }
      } catch {}
      await updateProfile({ location_lat: lat, location_lng: lng, location_city: newCity || undefined, location_region: newRegion || undefined });
      router.replace("/preparation");
    } catch (e: any) {
      Alert.alert("Ubicación", e?.message ?? "No se pudo obtener la ubicación");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}><ActivityIndicator /></View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12 }]}>
      <Text style={styles.title}>📍 Añadir ubicación</Text>
      <Text style={styles.subtitle}>Usamos tu ubicación para recomendar actividades cercanas. Puedes permitir la ubicación actual o escribir tu ciudad.</Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <TextInput
          placeholder="Ciudad / Comuna"
          placeholderTextColor="#374151"
          value={city}
          onChangeText={setCity}
          style={[styles.input, { flex: 1 }]}
        />
        <TextInput
          placeholder="Región (opcional)"
          placeholderTextColor="#374151"
          value={region}
          onChangeText={setRegion}
          style={[styles.input, { flex: 1 }]}
        />
      </View>

      <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={useCurrent} disabled={saving}>
        <Text style={styles.primaryText}>{saving ? "Guardando…" : "Usar mi ubicación actual"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.secondaryBtn]} onPress={saveManual} disabled={saving}>
        <Text style={styles.secondaryText}>Guardar manualmente</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 12, alignItems: "center" }} onPress={() => router.replace("/preparation")}>
        <Text style={{ color: "#6B7280", fontFamily: "NunitoRegular" }}>Ahora no</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg, padding: 16, paddingTop: 24 },
  title: { fontSize: 24, color: theme.text, fontFamily: "MontserratSemiBold" },
  subtitle: { marginTop: 8, color: "#4B5563", fontFamily: "NunitoRegular" },
  input: { backgroundColor: "#fff", color: theme.text, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border },
  primaryBtn: { backgroundColor: "#115E59", paddingVertical: 16, borderRadius: 24, alignItems: "center" },
  primaryText: { color: "#fff", fontFamily: "MontserratSemiBold", fontSize: 16 },
  secondaryBtn: { borderColor: theme.primary, borderWidth: 2, paddingVertical: 14, borderRadius: 24, alignItems: "center", marginTop: 12, backgroundColor: "#fff" },
  secondaryText: { color: theme.primary, fontFamily: "MontserratSemiBold" },
});
