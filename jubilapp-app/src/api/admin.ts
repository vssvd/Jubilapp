import * as FileSystem from "expo-file-system";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

import { API_BASE, authHeader, request } from "./client";

export type AdminStatus = {
  is_admin: boolean;
};

export type AdminUser = {
  uid: string;
  email: string;
  full_name?: string | null;
  created_at: string;
  last_activity_at?: string | null;
  status: string;
};

export type AdminUserList = {
  total: number;
  items: AdminUser[];
};

export type AdminUserFilters = {
  startDate?: string;
  endDate?: string;
};

export type AdminStatsSummary = {
  rangeStart: string;
  rangeEnd: string;
  totalDays: number;
  totalActivities: number;
  uniqueUsers: number;
  daysWithActivity: number;
  averageActivitiesPerDay: number;
  dauAverage: number;
  dauCurrent: number;
  mauCurrent: number;
};

export type AdminStatsDailyPoint = {
  date: string;
  activeUsers: number;
  activities: number;
};

export type AdminStatsMonthlyPoint = {
  month: string;
  label: string;
  activeUsers: number;
};

export type AdminStatsTopActivity = {
  id?: string | null;
  title: string;
  category?: string | null;
  count: number;
  percentage: number;
};

export type AdminStatsCategoryShare = {
  category: string;
  count: number;
  percentage: number;
};

export type AdminStats = {
  generatedAt: string;
  summary: AdminStatsSummary;
  dailyActive: AdminStatsDailyPoint[];
  monthlyActive: AdminStatsMonthlyPoint[];
  topActivities: AdminStatsTopActivity[];
  categoryBreakdown: AdminStatsCategoryShare[];
  exportFormats: string[];
};

export type AdminStatsFilters = {
  startDate?: string;
  endDate?: string;
  topLimit?: number;
};

export type AdminStatsExport = {
  uri: string;
  filename: string;
  mimeType: string;
};

function buildQuery(filters?: AdminUserFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function buildStatsQuery(filters?: AdminStatsFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  if (typeof filters.topLimit === "number") params.set("top_limit", String(filters.topLimit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function buildExportUrl(format: "csv" | "pdf", filters?: AdminStatsFilters): string {
  const query = buildStatsQuery(filters);
  const separator = query ? "&" : "?";
  return `${API_BASE}/api/admin/statistics/export${query}${separator}format=${format}`;
}

async function resolveAuthHeaders() {
  const headers = await authHeader();
  const authValue = headers.Authorization || headers.authorization;
  let token: string | undefined;
  if (authValue && authValue.startsWith("Bearer ")) {
    token = authValue.slice(7);
  }
  return { headers, token };
}

function buildExportFilename(format: "csv" | "pdf", filters?: AdminStatsFilters): string {
  if (filters?.startDate && filters?.endDate) {
    return `jubilapp-stats-${filters.startDate}-${filters.endDate}.${format}`;
  }
  const today = new Date().toISOString().slice(0, 10);
  return `jubilapp-stats-${today}.${format}`;
}

export async function fetchAdminStatus(): Promise<AdminStatus> {
  try {
    return await request<AdminStatus>("/api/admin/status");
  } catch (error: any) {
    // Si el backend responde 401/403 devolvemos acceso denegado en vez de lanzar
    if (typeof error?.status === "number" && [401, 403].includes(error.status)) {
      return { is_admin: false };
    }
    throw error;
  }
}

export async function fetchAdminUsers(filters?: AdminUserFilters): Promise<AdminUserList> {
  return request<AdminUserList>(`/api/admin/users${buildQuery(filters)}`);
}

export async function fetchAdminStats(filters?: AdminStatsFilters): Promise<AdminStats> {
  return request<AdminStats>(`/api/admin/statistics${buildStatsQuery(filters)}`);
}

export async function downloadAdminStats(format: "csv" | "pdf", filters?: AdminStatsFilters): Promise<AdminStatsExport> {
  const url = buildExportUrl(format, filters);
  const filename = buildExportFilename(format, filters);
  const mimeType = format === "csv" ? "text/csv" : "application/pdf";
  const { headers } = await resolveAuthHeaders();

  if (Platform.OS === "web") {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "No se pudo exportar las estadísticas.");
    }
    const blob = await response.blob();
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("No hay un directorio disponible para guardar el archivo.");
    }
    const blobUrl = window.URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      window.URL.revokeObjectURL(blobUrl);
    }
    return { uri: url, filename, mimeType };
  }

  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) {
    const error: Error & { code?: string } = new Error("No hay un directorio disponible para guardar el archivo.");
    error.code = "no_local_directory";
    throw error;
  }
  const fileUri = `${directory}${filename}`;
  const result = await FileSystem.downloadAsync(url, fileUri, { headers });
  return {
    uri: result.uri,
    filename,
    mimeType,
  };
}

export async function openAdminStatsExportInBrowser(format: "csv" | "pdf", filters?: AdminStatsFilters): Promise<void> {
  const url = buildExportUrl(format, filters);
  const { token } = await resolveAuthHeaders();
  if (!token) {
    throw new Error("No se encontró una sesión activa para generar el enlace.");
  }
  const connector = url.includes("?") ? "&" : "?";
  const finalUrl = `${url}${connector}token=${encodeURIComponent(token)}`;
  try {
    await WebBrowser.openBrowserAsync(finalUrl, { showInRecents: true });
  } catch {
    await Linking.openURL(finalUrl);
  }
}
