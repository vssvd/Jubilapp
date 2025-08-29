import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { fetchCatalog, fetchMyInterests, saveMyInterests, Interest } from "../api/interests";
import { useRouter } from "expo-router";

type Row = Interest & { selected?: boolean };

export default function InterestsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [catalog, mine] = await Promise.all([fetchCatalog(), fetchMyInterests()]);
        const mineIds = new Set(mine.map((i) => i.id));
        setRows(catalog.map((i) => ({ ...i, selected: mineIds.has(i.id) })));
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "No se pudo cargar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
      const k = r.category || "Otros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return Array.from(map.entries());
  }, [rows]);

  const toggle = (id: number) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));

  const selectedIds = useMemo(() => rows.filter((r) => r.selected).map((r) => r.id), [rows]);

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = await saveMyInterests(selectedIds);
      const ok = new Set(saved.map((s) => s.id));
      setRows((prev) => prev.map((r) => ({ ...r, selected: ok.has(r.id) })));

      Alert.alert("¡Guardado!", "Tus intereses fueron actualizados.", [
        { text: "Continuar", onPress: () => router.replace("/preparation") }, // ➜ HU004
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 8 }}>
        Selecciona tus intereses
      </Text>

      <FlatList
        data={grouped}
        keyExtractor={([cat]) => cat}
        renderItem={({ item: [cat, items] }) => (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "600", marginBottom: 8 }}>{cat}</Text>
            {items.map((i) => (
              <TouchableOpacity
                key={i.id}
                onPress={() => toggle(i.id)}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: i.selected ? "#0ea5e9" : "#d1d5db",
                  backgroundColor: i.selected ? "#e0f2fe" : "transparent",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>{i.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      <TouchableOpacity
        onPress={onSave}
        disabled={saving}
        style={{
          backgroundColor: "#0ea5e9",
          padding: 14,
          borderRadius: 14,
          alignItems: "center",
          opacity: saving ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>
          {saving ? "Guardando..." : "Guardar intereses"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/preparation")}
        style={{ padding: 12, alignItems: "center", marginTop: 8 }}
      >
        <Text style={{ color: "#2563eb", fontWeight: "600" }}>Saltar por ahora</Text>
      </TouchableOpacity>

      <Text style={{ textAlign: "center", color: "#6b7280", marginTop: 6 }}>
        Seleccionados: {selectedIds.length}
      </Text>
    </View>
  );
}
