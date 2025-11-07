import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Modal, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { fetchProfile, updateProfile } from "../src/api/profile";
import { useRouter, useNavigation } from "expo-router";
import { theme } from "../src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { logout } from "../src/api/auth";
import { fetchPreparation, savePreparation, type PreparationLevel, type MobilityLevel } from "../src/api/preparation";
import * as Location from "expo-location";
import { fetchAdminStatus } from "../src/api/admin";

const PREPARATION_OPTIONS: { key: PreparationLevel; title: string; description: string }[] = [
  { key: "planificado", title: "Planificado", description: "Tengo metas y actividades definidas." },
  { key: "intermedio", title: "Intermedio", description: "Tengo ideas, pero no completamente organizadas." },
  { key: "desorientado", title: "Desorientado", description: "No sé por dónde empezar." },
];

const MOBILITY_OPTIONS: { key: MobilityLevel; title: string; description: string }[] = [
  { key: "baja", title: "Movilidad baja", description: "Prefiero actividades suaves o con poco desplazamiento." },
  { key: "media", title: "Movilidad media", description: "Puedo moverme con pausas o distancias cortas." },
  { key: "alta", title: "Movilidad alta", description: "No tengo limitaciones para desplazarme." },
];

const AVATAR_SETS: { title: string; options: string[] }[] = [
  {
    title: "Personas",
    options: ["👤", "👩", "👨", "👴", "👵", "👥"],
  },
  {
    title: "Intereses",
    options: ["🎨", "📚", "🎶", "🚶", "🧘", "🏞️", "🎲"],
  },
  {
    title: "Naturaleza y compañía",
    options: ["🐱", "🐶", "🌻", "🌳"],
  },
  {
    title: "Estilo",
    options: ["⭐", "❤️", "🌈", "☀️"],
  },
  {
    title: "Identidad",
    options: ["🟢", "🔵", "🟣", "🟠", "🟥", "🟩"],
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descSaving, setDescSaving] = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [preparation, setPreparation] = useState<PreparationLevel | null>(null);
  const [mobility, setMobility] = useState<MobilityLevel | null>(null);
  const [prepSaving, setPrepSaving] = useState(false);
  const [mobilitySaving, setMobilitySaving] = useState(false);
  const [showPrepPicker, setShowPrepPicker] = useState(false);
  const [showMobilityPicker, setShowMobilityPicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [data, prepInfo] = await Promise.all([
          fetchProfile(),
          fetchPreparation().catch(() => ({ preparation_level: null, mobility_level: null })),
        ]);
        setFullName((data.full_name ?? "").toString());
        setEmail(data.email ?? null);
        setDescription((data.description ?? "").toString());
        setDescriptionDraft((data.description ?? "").toString());
        setAvatarEmoji((data.photo_url ?? null) as any);
        setCity((data.location_city ?? "").toString());
        setRegion((data.location_region ?? "").toString());
        setPreparation((prepInfo?.preparation_level ?? null) as PreparationLevel | null);
        setMobility((prepInfo?.mobility_level ?? null) as MobilityLevel | null);
      } catch (e: any) {
        Alert.alert("Sesión", e?.message ?? "Vuelve a iniciar sesión.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await fetchAdminStatus();
        if (active) {
          setIsAdmin(status.is_admin);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
        }
      } finally {
        if (active) {
          setAdminChecked(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const performLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  }, [router]);

  const confirmLogout = useCallback(() => {
    Alert.alert("Cerrar sesión", "¿Seguro que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar", style: "destructive", onPress: () => { void performLogout(); } },
    ]);
  }, [performLogout]);

  const applyPreparationLevel = useCallback(async (level: PreparationLevel) => {
    setPrepSaving(true);
    try {
      const info = await savePreparation({ preparation_level: level });
      setPreparation(info.preparation_level);
      setMobility(info.mobility_level ?? null);
      Alert.alert("Nivel actualizado", "Guardamos tu nivel de preparación ✅");
      setShowPrepPicker(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar el nivel");
    } finally {
      setPrepSaving(false);
    }
  }, []);

  const applyMobilityLevel = useCallback(async (level: MobilityLevel) => {
    setMobilitySaving(true);
    try {
      const info = await savePreparation({ mobility_level: level });
      setMobility(info.mobility_level);
      setPreparation(info.preparation_level ?? null);
      Alert.alert("Movilidad actualizada", "Guardamos tu nivel de movilidad ✅");
      setShowMobilityPicker(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar la movilidad");
    } finally {
      setMobilitySaving(false);
    }
  }, []);

  // Back de header personalizado para evitar warnings del beforeRemove en native-stack
  useEffect(() => {
    (navigation as any)?.setOptions?.({
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.replace("/home")} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: theme.primary, fontWeight: "700" }}>{"< JubilApp"}</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={confirmLogout}
          accessibilityLabel="Cerrar sesión"
          accessibilityHint="Termina la sesión actual"
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <Ionicons name="log-out-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, confirmLogout]);

  const onSave = async () => {
    const name = fullName.trim();
    if (!name) {
      Alert.alert("Nombre requerido", "El nombre no puede estar vacío.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ full_name: name, description: description });
      Alert.alert("Guardado", "Tus cambios han sido guardados ✅");
      // Volver a Home tras guardar con éxito
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const selectAvatar = useCallback(async (emoji: string) => {
    const previous = avatarEmoji;
    try {
      setSaving(true);
      setAvatarEmoji(emoji);
      await updateProfile({ photo_url: emoji });
      Alert.alert("Avatar actualizado", "Guardamos tu icono de perfil ✅");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar el icono");
      setAvatarEmoji(previous ?? null);
    } finally {
      setSaving(false);
    }
  }, [avatarEmoji]);

  const handlePickAvatar = useCallback(async (emoji: string) => {
    await selectAvatar(emoji);
    setShowAvatarPicker(false);
  }, [selectAvatar]);

  const openDescriptionEditor = () => {
    setDescriptionDraft(description);
    setShowDescriptionEditor(true);
  };

  const saveDescription = async () => {
    if (descSaving) return;
    setDescSaving(true);
    try {
      await updateProfile({ description: descriptionDraft });
      setDescription(descriptionDraft);
      setShowDescriptionEditor(false);
      Alert.alert("Descripción", "Actualizamos tu texto de perfil ✅");
    } catch (e: any) {
      Alert.alert("Descripción", e?.message ?? "No se pudo guardar la descripción");
    } finally {
      setDescSaving(false);
    }
  };

  const askAndSetCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso de ubicación",
          "No pudimos obtener tu ubicación. Puedes ingresarla manualmente.",
        );
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
      Alert.alert("Ubicación actualizada", "Guardamos tu ubicación para recomendarte actividades cercanas ✅");
    } catch (e: any) {
      Alert.alert("Ubicación", e?.message ?? "No se pudo obtener la ubicación");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={{ fontSize: 28 }}>{avatarEmoji || (fullName || email || "?").slice(0,1).toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.linkBtn} onPress={() => setShowAvatarPicker(true)} disabled={saving}>
              <Text style={styles.linkText}>Cambiar icono</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Correo</Text>
          <Text style={styles.readonly}>{email ?? "—"}</Text>

          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            placeholder="Tu nombre"
            placeholderTextColor={theme.muted}
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
          />

          <Text style={styles.label}>Descripción</Text>
          <TouchableOpacity style={styles.descriptionChip} onPress={openDescriptionEditor} accessibilityRole="button">
            <Text style={description ? styles.descriptionText : styles.descriptionPlaceholder}>
              {description ? (description.length > 80 ? `${description.slice(0, 80)}…` : description) : "Añade una breve descripción"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 8 }]}>Ubicación</Text>
          <Text style={{ color: theme.muted, marginBottom: 6 }}>
            La ubicación solo se usa para recomendar actividades cercanas.
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              placeholder="Ciudad / Comuna"
              placeholderTextColor={theme.muted}
              value={city}
              onChangeText={setCity}
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              placeholder="Región (opcional)"
              placeholderTextColor={theme.muted}
              value={region}
              onChangeText={setRegion}
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={async () => {
              if (!city.trim()) { Alert.alert("Ubicación", "Ingresa al menos la ciudad/comuna."); return; }
              setSaving(true);
              try {
                await updateProfile({ location_city: city.trim(), location_region: region.trim() || undefined });
                Alert.alert("Ubicación", "Guardada correctamente ✅");
              } catch (e: any) {
                Alert.alert("Error", e?.message || "No se pudo guardar");
              } finally { setSaving(false); }
            }} disabled={saving}>
              <Text style={styles.saveText}>{saving ? "Guardando…" : "Guardar ubicación"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, alignItems: "center", borderWidth: 1, borderColor: theme.primary, borderRadius: 14 }]} onPress={askAndSetCurrentLocation} disabled={saving}>
              <Text style={[styles.secondaryText, { fontWeight: "800" }]}>Usar mi ubicación actual</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionDivider} />
          <Text style={styles.label}>Nivel de preparación</Text>
          <TouchableOpacity style={styles.prepChip} onPress={() => setShowPrepPicker(true)} accessibilityRole="button">
            <View>
              <Text style={styles.prepChipTitle}>
                {preparation ? PREPARATION_OPTIONS.find((o) => o.key === preparation)?.title ?? "Selecciona tu nivel" : "Selecciona tu nivel"}
              </Text>
              <Text style={styles.prepChipSubtitle} numberOfLines={1}>
                {preparation ? PREPARATION_OPTIONS.find((o) => o.key === preparation)?.description ?? "" : "Tócalo para elegir"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 16 }]}>Movilidad física</Text>
          <TouchableOpacity style={styles.prepChip} onPress={() => setShowMobilityPicker(true)} accessibilityRole="button">
            <View>
              <Text style={styles.prepChipTitle}>
                {mobility ? MOBILITY_OPTIONS.find((o) => o.key === mobility)?.title ?? "Selecciona tu movilidad" : "Selecciona tu movilidad"}
              </Text>
              <Text style={styles.prepChipSubtitle} numberOfLines={1}>
                {mobility ? MOBILITY_OPTIONS.find((o) => o.key === mobility)?.description ?? "" : "Tócalo para elegir"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? "Guardando…" : "Guardar cambios"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/interests")}>
            <Text style={styles.secondaryText}>Editar intereses</Text>
          </TouchableOpacity>

          {adminChecked && isAdmin ? (
            <TouchableOpacity
              style={styles.adminCard}
              onPress={() => router.push("/admin")}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.adminCardTitle}>Panel administrador</Text>
                <Text style={styles.adminCardSubtitle}>Consulta la lista de usuarios registrados y sus estados.</Text>
              </View>
              <Text style={{ fontSize: 32 }}>👑</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={showAvatarPicker} transparent animationType="slide" onRequestClose={() => setShowAvatarPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAvatarPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Elige un icono</Text>
              <TouchableOpacity onPress={() => setShowAvatarPicker(false)}>
                <Text style={styles.modalClose}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.avatarPickerScroll}>
              {AVATAR_SETS.map((set) => (
                <View key={set.title} style={{ marginBottom: 16 }}>
                  <Text style={styles.avatarSectionTitle}>{set.title}</Text>
                  <View style={styles.avatarGrid}>
                    {set.options.map((emoji) => {
                      const active = avatarEmoji === emoji;
                      return (
                        <TouchableOpacity
                          key={emoji}
                          style={[styles.avatarChoice, active && styles.avatarChoiceActive]}
                          onPress={() => { void handlePickAvatar(emoji); }}
                          disabled={saving}
                          accessibilityLabel={`Elegir icono ${emoji}`}
                        >
                          <Text style={{ fontSize: 26 }}>{emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showPrepPicker} transparent animationType="slide" onRequestClose={() => setShowPrepPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPrepPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona tu nivel</Text>
              <TouchableOpacity onPress={() => setShowPrepPicker(false)}>
                <Text style={styles.modalClose}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.avatarPickerScroll}>
              {PREPARATION_OPTIONS.map((opt) => {
                const active = preparation === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.prepOption, active && styles.prepOptionActive]}
                    onPress={() => { if (!prepSaving) { void applyPreparationLevel(opt.key); } }}
                    disabled={prepSaving}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.prepTitle, active && styles.prepTitleActive]}>{opt.title}</Text>
                      <Text style={styles.prepDescription}>{opt.description}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={theme.primary} style={{ marginLeft: 12 }} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showMobilityPicker} transparent animationType="slide" onRequestClose={() => setShowMobilityPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMobilityPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona tu movilidad</Text>
              <TouchableOpacity onPress={() => setShowMobilityPicker(false)}>
                <Text style={styles.modalClose}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.avatarPickerScroll}>
              {MOBILITY_OPTIONS.map((opt) => {
                const active = mobility === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.prepOption, active && styles.prepOptionActive]}
                    onPress={() => { if (!mobilitySaving) { void applyMobilityLevel(opt.key); } }}
                    disabled={mobilitySaving}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.prepTitle, active && styles.prepTitleActive]}>{opt.title}</Text>
                      <Text style={styles.prepDescription}>{opt.description}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={theme.primary} style={{ marginLeft: 12 }} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showDescriptionEditor} transparent animationType="slide" onRequestClose={() => setShowDescriptionEditor(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDescriptionEditor(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar descripción</Text>
                <TouchableOpacity onPress={() => setShowDescriptionEditor(false)}>
                  <Text style={styles.modalClose}>Cerrar</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={descriptionDraft}
                onChangeText={setDescriptionDraft}
                placeholder="Cuéntanos algo sobre ti"
                placeholderTextColor={theme.muted}
                multiline
                numberOfLines={4}
                style={styles.descriptionInput}
              />
              <TouchableOpacity
                style={[styles.saveBtn, descSaving && { opacity: 0.7 }]}
                onPress={saveDescription}
                disabled={descSaving}
              >
                <Text style={styles.saveText}>{descSaving ? "Guardando…" : "Guardar descripción"}</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  root: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 16, paddingBottom: 48 },
  container: { backgroundColor: theme.bg },
  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: theme.border },
  label: { color: theme.muted, marginTop: 12, marginBottom: 6 },
  readonly: { color: theme.text, backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  input: {
    backgroundColor: "#fff",
    color: theme.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  saveBtn: { backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 16 },
  saveText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { paddingVertical: 12, alignItems: "center", marginTop: 12 },
  secondaryText: { color: theme.primary, fontWeight: "700" },
  adminCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adminCardTitle: { fontSize: 16, fontWeight: "800", color: theme.text },
  adminCardSubtitle: { color: theme.muted, marginTop: 4 },
  avatarSectionTitle: { color: theme.text, fontWeight: "600", marginBottom: 6 },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  avatarChoice: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },
  avatarChoiceActive: { borderColor: theme.primary, backgroundColor: "#ECFDF5" },
  helperText: { color: theme.muted, marginBottom: 12 },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.primary },
  linkText: { color: theme.primary, fontWeight: "700" },
  descriptionChip: {
    backgroundColor: "#f4f4f5",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginBottom: 4,
  },
  descriptionText: { color: theme.text, fontSize: 14 },
  descriptionPlaceholder: { color: theme.muted, fontSize: 14 },
  sectionDivider: { marginTop: 24, marginBottom: 8, height: 1, backgroundColor: theme.border },
  prepChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  prepChipTitle: { fontWeight: "700", color: theme.text, fontSize: 16 },
  prepChipSubtitle: { color: theme.muted, marginTop: 2, fontSize: 13 },
  prepOption: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  prepOptionActive: {
    borderColor: theme.primary,
    backgroundColor: "#ECFDF5",
  },
  prepTitle: { fontWeight: "700", color: theme.text, fontSize: 16, marginBottom: 4 },
  prepTitleActive: { color: theme.primary },
  prepDescription: { color: theme.muted, fontSize: 14 },
  prepSaveBtn: { marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: theme.text },
  modalClose: { color: theme.primary, fontWeight: "700" },
  avatarPickerScroll: { paddingBottom: 12 },
  descriptionInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    padding: 12,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 16,
  },
});
