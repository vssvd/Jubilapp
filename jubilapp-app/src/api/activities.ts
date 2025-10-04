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

