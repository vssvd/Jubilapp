import { request } from "./client";

export type ActivityEvent = {
  id: string;
  type: string;
  title: string;
  category?: string | null;
  dateTime?: string | null;
  location?: string | null;
  link: string;
  origin: string;
  createdAt: string;
  tags?: string[] | null;
  distanceKm?: number | null;
  venue?: {
    name?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
};

export type ActivityActor = {
  uid?: string | null;
  email?: string | null;
  name?: string | null;
};

export type CatalogActivity = ActivityEvent & {
  updatedAt?: string | null;
  createdBy?: ActivityActor | null;
  updatedBy?: ActivityActor | null;
};

export type ActivityHistoryEntry = {
  id: string;
  activityId?: string | null;
  title: string;
  emoji?: string | null;
  category?: string | null;
  type?: string | null;
  origin?: string | null;
  dateTime?: string | null;
  completedAt: string;
  createdAt: string;
  updatedAt?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  rating?: number | null;
};

export type ActivityFavorite = {
  id: string;
  activityId: string;
  activityType: string;
  title: string;
  emoji?: string | null;
  category?: string | null;
  origin?: string | null;
  link?: string | null;
  dateTime?: string | null;
  tags?: string[] | null;
  source?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type CreateFavoriteInput = {
  activityId: string;
  activityType: string;
  title: string;
  emoji?: string | null;
  category?: string | null;
  origin?: string | null;
  link?: string | null;
  dateTime?: string | null;
  tags?: string[] | null;
  source?: Record<string, unknown> | null;
};

export type ActivityReport = {
  id: string;
  activityId: string;
  activityType: string;
  reason?: string | null;
  title?: string | null;
  emoji?: string | null;
  category?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type CreateActivityReportInput = {
  activityId: string;
  activityType: string;
  reason?: string | null;
  title?: string | null;
  emoji?: string | null;
  category?: string | null;
};

export type FetchUpcomingEventsOptions = {
  limit?: number;
  daysAhead?: number;
  freeOnly?: boolean;
  matchMyInterests?: boolean;
  interests?: string[];
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

export async function fetchUpcomingEvents(options: FetchUpcomingEventsOptions = {}): Promise<ActivityEvent[]> {
  const params = new URLSearchParams();

  if (options.limit) params.set("limit", String(options.limit));
  if (options.daysAhead) params.set("daysAhead", String(options.daysAhead));
  if (options.freeOnly) params.set("freeOnly", "true");
  if (options.matchMyInterests) params.set("matchMyInterests", "true");
  if (options.interests?.length) {
    options.interests.forEach((interest) => {
      if (interest) params.append("interests", interest);
    });
  }
  if (options.city) params.set("city", options.city);
  if (typeof options.lat === "number") params.set("lat", String(options.lat));
  if (typeof options.lng === "number") params.set("lng", String(options.lng));
  if (typeof options.radiusKm === "number") params.set("radiusKm", String(options.radiusKm));

  const query = params.toString();
  const path = `/api/activities/events/upcoming${query ? `?${query}` : ""}`;
  return request<ActivityEvent[]>(path);
}

export type FetchActivityHistoryOptions = {
  fromDate?: string;
  toDate?: string;
  category?: string;
  limit?: number;
  offset?: number;
};

export async function fetchActivityHistory(options: FetchActivityHistoryOptions = {}): Promise<ActivityHistoryEntry[]> {
  const params = new URLSearchParams();
  if (options.fromDate) params.set("fromDate", options.fromDate);
  if (options.toDate) params.set("toDate", options.toDate);
  if (options.category) params.set("category", options.category);
  if (typeof options.limit === "number") params.set("limit", String(options.limit));
  if (typeof options.offset === "number") params.set("offset", String(options.offset));

  const query = params.toString();
  const path = `/api/activities/history${query ? `?${query}` : ""}`;
  return request<ActivityHistoryEntry[]>(path);
}

export type CreateHistoryEntryInput = {
  activityId?: string | null;
  title: string;
  emoji?: string | null;
  category?: string | null;
  type?: string | null;
  origin?: string | null;
  dateTime?: string | null;
  completedAt?: string;
  tags?: string[] | null;
  notes?: string | null;
};

export async function createHistoryEntry(payload: CreateHistoryEntryInput): Promise<ActivityHistoryEntry> {
  return request<ActivityHistoryEntry>("/api/activities/history", {
    method: "POST",
    body: payload,
  });
}

export type SubmitHistoryFeedbackInput = {
  rating: number;
  comment?: string | null;
};

export async function submitHistoryFeedback(historyId: string, payload: SubmitHistoryFeedbackInput): Promise<ActivityHistoryEntry> {
  return request<ActivityHistoryEntry>(`/api/activities/history/${historyId}/feedback`, {
    method: "POST",
    body: payload,
  });
}

export async function deleteHistoryEntry(historyId: string): Promise<void> {
  await request(`/api/activities/history/${encodeURIComponent(historyId)}`, {
    method: "DELETE",
  });
}

export async function fetchFavorites(): Promise<ActivityFavorite[]> {
  return request<ActivityFavorite[]>("/api/activities/favorites");
}

export async function createFavorite(input: CreateFavoriteInput): Promise<ActivityFavorite> {
  return request<ActivityFavorite>("/api/activities/favorites", {
    method: "POST",
    body: input,
  });
}

export async function deleteFavorite(favoriteId: string): Promise<void> {
  await request(`/api/activities/favorites/${encodeURIComponent(favoriteId)}`, {
    method: "DELETE",
  });
}

export async function createActivityReport(input: CreateActivityReportInput): Promise<ActivityReport> {
  const payload = {
    activityId: input.activityId,
    activityType: input.activityType,
    reason: input.reason ?? null,
    title: input.title ?? null,
    emoji: input.emoji ?? null,
    category: input.category ?? null,
  };
  console.log("[api] createActivityReport payload", payload);
  return request<ActivityReport>("/api/activities/reports", {
    method: "POST",
    body: payload,
  });
}

export async function fetchActivityReports(): Promise<ActivityReport[]> {
  return request<ActivityReport[]>("/api/activities/reports");
}

export async function deleteActivityReport(activityType: string, activityId: string): Promise<void> {
  const path = `/api/activities/reports/${encodeURIComponent(activityType)}/${encodeURIComponent(activityId)}`;
  await request(path, { method: "DELETE" });
}

export type ActivityInput = {
  type: string;
  title: string;
  category?: string | null;
  dateTime?: string | null;
  location?: string | null;
  link: string;
  origin: string;
  tags?: string[];
  venue?: ActivityEvent["venue"];
};

export type ActivityUpdateInput = Partial<ActivityInput>;

export type FetchActivitiesOptions = {
  category?: string;
  origin?: string;
  type?: string;
  limit?: number;
  offset?: number;
};

function serializeActivityPayload(payload: ActivityInput | ActivityUpdateInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const assign = (key: keyof ActivityInput) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = (payload as any)[key];
      if (value !== undefined) {
        body[key] = value;
      }
    }
  };
  assign("type");
  assign("title");
  assign("category");
  assign("dateTime");
  assign("location");
  assign("link");
  assign("origin");
  assign("tags");
  assign("venue");
  return body;
}

export async function fetchActivities(options: FetchActivitiesOptions = {}): Promise<CatalogActivity[]> {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.origin) params.set("origin", options.origin);
  if (options.type) params.set("type", options.type);
  if (typeof options.limit === "number") params.set("limit", String(options.limit));
  if (typeof options.offset === "number") params.set("offset", String(options.offset));
  const query = params.toString();
  const path = `/api/activities${query ? `?${query}` : ""}`;
  return request<CatalogActivity[]>(path);
}

export async function createActivity(payload: ActivityInput): Promise<CatalogActivity> {
  return request<CatalogActivity>("/api/activities", {
    method: "POST",
    body: serializeActivityPayload(payload),
  });
}

export async function updateActivity(id: string, payload: ActivityUpdateInput): Promise<CatalogActivity> {
  return request<CatalogActivity>(`/api/activities/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: serializeActivityPayload(payload),
  });
}

export async function deleteActivity(id: string): Promise<void> {
  await request(`/api/activities/${encodeURIComponent(id)}`, { method: "DELETE" });
}
