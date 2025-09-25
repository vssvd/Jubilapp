import type { ExpoConfig } from "@expo/config-types";
import appJson from "./app.json";

const config = appJson.expo as ExpoConfig;

config.ios = {
  ...(config.ios || {}),
  bundleIdentifier: process.env.EXPO_IOS_BUNDLE_ID || "com.jubilapp.app",
};

config.android = {
  ...(config.android || {}),
  package: process.env.EXPO_ANDROID_PACKAGE || "com.jubilapp.app",
};

export default config;
