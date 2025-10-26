import "react-native-get-random-values";
import "../src/firebaseConfig";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat";
import { Nunito_400Regular } from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { AuthProvider } from "../src/auth/AuthProvider";
import { theme } from "../src/lib/theme";

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    MontserratSemiBold: Montserrat_600SemiBold,
    NunitoRegular: Nunito_400Regular,
  });

  if (!loaded) return null;

  return (
    <AuthProvider>
      <ThemeProvider value={DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            headerTitleStyle: { color: theme.text, fontWeight: "800" },
          }}
        >
          {/* Títulos agradables y consistentes */}
          <Stack.Screen name="index" options={{ title: "JubilApp", headerShown: false }} />
          <Stack.Screen name="login" options={{ title: "🔐 Iniciar sesión", headerShown: false }} />
          <Stack.Screen name="register" options={{ title: "✍️ Crear cuenta", headerShown: false }} />
          <Stack.Screen name="home" options={{ title: "🎉 Bienvenida", headerShown: false }} />
          <Stack.Screen name="favorites" options={{ title: "⭐ Favoritos", headerShown: false }} />
          <Stack.Screen name="history" options={{ title: "📘 Historial", headerShown: false }} />
          <Stack.Screen name="interests" options={{ title: "📝 Intereses", headerShown: false }} />
          <Stack.Screen name="interests/index" options={{ title: "Elige cómo continuar" }} />
          <Stack.Screen name="interests/assistant" options={{ title: "Entrevista asistida" }} />
          <Stack.Screen name="interests/manual" options={{ title: "Cuestionario manual" }} />
          <Stack.Screen name="profile" options={{ title: "👤 Perfil" }} />
          <Stack.Screen name="preparation" options={{ title: "🎯 Preparación", headerShown: false }} />
          <Stack.Screen name="location" options={{ title: "📍 Ubicación", headerShown: false }} />
          <Stack.Screen name="tutorial" options={{ title: "Tutorial", headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ title: "Oops!" }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </AuthProvider>
  );
}
