import { request } from "./client";

export type Profile = {
  email?: string | null;
  full_name?: string | null;
  description?: string | null;
  photo_url?: string | null;
};

export async function fetchProfile(): Promise<Profile> {
  return request<Profile>("/api/profile");
}

export async function updateProfile(input: Partial<{ full_name: string; description: string; photo_url: string | null }>): Promise<Profile> {
  return request<Profile>("/api/profile", { method: "PUT", body: input });
}
