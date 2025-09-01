import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "../src/lib/theme";

type Step = { title: string; subtitle: string; emoji: string };

export default function TutorialScreen() {
  const router = useRouter();
  const steps: Step[] = useMemo(() => [
    { title: "Bienvenido a JubilApp 👋", subtitle: "Tu compañera para planear y disfrutar tu jubilación.", emoji: "👵🏻👴🏻" },
    { title: "Crea tu cuenta en minutos ✨", subtitle: "Solo necesitas tu correo y una contraseña.", emoji: "✍️" },
    { title: "Accede a rutinas y actividades 🗓️", subtitle: "Encuentra opciones según tus intereses y estilo de vida.", emoji: "🗓️" },
    { title: "¡Todo listo para comenzar! 🎉", subtitle: "Disfruta tu nueva etapa con JubilApp.", emoji: "🎉" },
  ], []);
  const [idx, setIdx] = useState(0);
  const IMAGES = [
    require("../assets/images/tutorial-1.png"),
    require("../assets/images/tutorial-2.png"),
    require("../assets/images/tutorial-3.png"),
    require("../assets/images/tutorial-4.png"),
  ] as const;

  const onSkip = () => router.replace("/");
  const onNext = () => {
    if (idx >= steps.length - 1) return onSkip();
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const isLast = idx === steps.length - 1;
  const s = steps[idx];
  const boxH = Math.min(500, Math.round(Dimensions.get("window").height * 0.46));

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onSkip} style={styles.skip} accessibilityRole="button">
        <Text style={styles.skipText}>Saltar</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <View style={[styles.illustrationBox, { height: boxH }]}>
          <Image source={IMAGES[idx]} style={styles.illustration} resizeMode="cover" />
        </View>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.subtitle}>{s.subtitle}</Text>

        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
      </View>

      <TouchableOpacity onPress={onNext} style={[styles.cta, isLast && styles.ctaPrimary]}>
        <Text style={[styles.ctaText, isLast && { color: "#fff" }]}>{isLast ? "Comenzar" : "Siguiente"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F6", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  skip: { position: "absolute", top: 16, right: 16, zIndex: 2, padding: 8 },
  skipText: { color: theme.primary, fontFamily: "NunitoRegular", fontSize: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  illustrationBox: { width: "92%", maxWidth: 620, overflow: "hidden", borderRadius: 16, marginBottom: 20 },
  illustration: { width: "100%", height: "100%" },
  title: { fontFamily: "MontserratSemiBold", fontSize: 28, color: "#111827", textAlign: "center", lineHeight: Platform.select({ ios: 32, android: 34, default: 32 }) },
  subtitle: { marginTop: 8, color: "#4B5563", textAlign: "center", fontFamily: "NunitoRegular", fontSize: 16, lineHeight: Platform.select({ ios: 20, android: 22, default: 20 }) },
  dotsRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D1D5DB" },
  dotActive: { backgroundColor: theme.primary },
  cta: { backgroundColor: "#ffffff", borderColor: theme.primary, borderWidth: 2, paddingVertical: 14, borderRadius: 24, alignItems: "center" },
  ctaPrimary: { backgroundColor: "#115E59", borderWidth: 0 },
  ctaText: { fontSize: 20, color: "#111827", fontFamily: "MontserratSemiBold" },
});
