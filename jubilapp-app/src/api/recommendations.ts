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
  is_fallback?: boolean;
  category?: string | null;
  is_favorite?: boolean;
  accessibility_labels?: string[] | null;
};

export type FetchAtemporalRecommendationsOptions = {
  limit?: number;
  categories?: string[];
};

export async function fetchAtemporalRecommendations(
  options: FetchAtemporalRecommendationsOptions = {},
): Promise<AtemporalActivity[]> {
  const params = new URLSearchParams();

  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  if (options.categories?.length) {
    options.categories.forEach((category) => {
      const value = category?.trim().toLowerCase();
      if (value) params.append("categories", value);
    });
  }

  const query = params.toString();
  const data = await request<{ activities: AtemporalActivity[] }>(
    `/api/recommendations/atemporales${query ? `?${query}` : ""}`,
  );
  return data.activities;
}
