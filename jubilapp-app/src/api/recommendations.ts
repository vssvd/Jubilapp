import { request } from "./client";

export type EnergyLevel = "baja" | "media" | "alta";
export type CostLevel = "gratis" | "bajo" | "medio" | "alto";
export type TimeOfDay = "manana" | "tarde" | "noche" | "cualquiera";

export type AtemporalActivity = {
  id: number;
  title: string;
  emoji: string;
  tags: string[];
  indoor: boolean;
  energy: EnergyLevel;
  duration_min: number;
  cost: CostLevel;
  time_of_day: TimeOfDay;
  suggested_time?: string | null;
};

export async function fetchAtemporalRecommendations(limit = 8): Promise<AtemporalActivity[]> {
  const data = await request<{ activities: AtemporalActivity[] }>(
    `/api/recommendations/atemporales?limit=${encodeURIComponent(limit)}`
  );
  return data.activities;
}

