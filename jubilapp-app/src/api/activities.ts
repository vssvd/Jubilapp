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
};

export type FetchUpcomingEventsOptions = {
  limit?: number;
  daysAhead?: number;
  freeOnly?: boolean;
  matchMyInterests?: boolean;
  interests?: string[];
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

export async function deleteHistoryEntry(historyId: string): Promise<void> {
  await request(`/api/activities/history/${encodeURIComponent(historyId)}`, {
    method: "DELETE",
  });
}
