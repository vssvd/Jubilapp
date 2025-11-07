import { request } from "./client";

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

function buildQuery(filters?: AdminUserFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
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
