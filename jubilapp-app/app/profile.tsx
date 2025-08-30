import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { fetchProfile, updateProfile } from "../src/api/profile";
import { useRouter } from "expo-router";
import { theme } from "../src/lib/theme";
import * as ImagePicker from "expo-image-picker";
import { auth } from "../src/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Image } from "expo-image";

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProfile();
        setFullName((data.full_name ?? "").toString());
        setEmail(data.email ?? null);
        setDescription((data.description ?? "").toString());
        setPhotoUrl((data.photo_url ?? null) as any);
      } catch (e: any) {
        Alert.alert("Sesión", e?.message ?? "Vuelve a iniciar sesión.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const pickAndUpload = async () => {
    try {
      // Permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para continuar.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // usa string literal para evitar incompatibilidades ('Images' vs 'images')
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      if (!uri) return;

      setSaving(true);
      const user = auth.currentUser;
      if (!user) throw new Error("No autenticado");

      const res = await fetch(uri);
      const blob = await res.blob();
      const storage = getStorage();
      const fileRef = ref(storage, `avatars/${user.uid}.jpg`);
      await uploadBytes(fileRef, blob, { contentType: asset.mimeType || "image/jpeg" });
      const url = await getDownloadURL(fileRef);
      setPhotoUrl(url);
      await updateProfile({ photo_url: url });
      Alert.alert("Foto actualizada", "Tu foto de perfil se actualizó ✅");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo subir la imagen");
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
    <View style={styles.container}>
      <View style={styles.avatarRow}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>{(fullName || email || "?").slice(0,1).toUpperCase()}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.linkBtn} onPress={pickAndUpload} disabled={saving}>
          <Text style={styles.linkText}>Cambiar foto</Text>
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
      <TextInput
        placeholder="Cuéntanos algo sobre ti"
        placeholderTextColor={theme.muted}
        value={description}
        onChangeText={setDescription}
        style={[styles.input, { height: 100, textAlignVertical: "top" }]}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? "Guardando…" : "Guardar cambios"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/interests")}>
        <Text style={styles.secondaryText}>Editar intereses</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#ddd" },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: theme.primary },
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
  linkBtn: { marginLeft: 12, padding: 8 },
  linkText: { color: theme.primary, fontWeight: "700" },
});
