import { request } from "./client";

export type Profile = {
  email?: string | null;
  full_name?: string | null;
  description?: string | null;
  photo_url?: string | null;
  // Ubicación
  location_city?: string | null;
  location_region?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
};

export async function fetchProfile(): Promise<Profile> {
  return request<Profile>("/api/profile");
}

export type ProfileUpdateInput = Partial<{
  full_name: string;
  description: string;
  photo_url: string | null;
  location_city: string;
  location_region: string;
  location_lat: number;
  location_lng: number;
}>;

export async function updateProfile(input: ProfileUpdateInput): Promise<Profile> {
  return request<Profile>("/api/profile", { method: "PUT", body: input });
}
