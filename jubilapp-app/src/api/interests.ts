import { request } from "./client";

export type Interest = { id: number; name: string; category?: string | null };

export const fetchCatalog = async (): Promise<Interest[]> => {
  return request<Interest[]>("/api/interests/catalog"); // público
};

export const fetchMyInterests = async (): Promise<Interest[]> => {
  const data = await request<{ interests: Interest[] }>("/api/interests/me"); // requiere token
  return data.interests;
};

export const saveMyInterests = async (ids: number[]): Promise<Interest[]> => {
  const data = await request<{ interests: Interest[] }>("/api/interests/me", {
    method: "PUT",
    body: { interest_ids: ids },
  });
  return data.interests;
};
