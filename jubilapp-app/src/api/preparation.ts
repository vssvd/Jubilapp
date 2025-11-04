import { authHeader, API_BASE } from "./client";

export type PreparationLevel = "planificado" | "intermedio" | "desorientado";
export type MobilityLevel = "baja" | "media" | "alta";

export type PreparationInfo = {
  preparation_level: PreparationLevel | null;
  mobility_level: MobilityLevel | null;
};

export type PreparationUpdatePayload = {
  preparation_level?: PreparationLevel | null;
  mobility_level?: MobilityLevel | null;
};

export async function fetchPreparation(): Promise<PreparationInfo> {
  const res = await fetch(`${API_BASE}/api/profile/preparation`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error("No se pudo cargar el nivel");
  const data = await res.json();
  return {
    preparation_level: (data.preparation_level ?? null) as PreparationLevel | null,
    mobility_level: (data.mobility_level ?? null) as MobilityLevel | null,
  };
}

export async function savePreparation(payload: PreparationUpdatePayload): Promise<PreparationInfo> {
  const bodyPayload: Record<string, unknown> = {};
  if (payload.preparation_level !== undefined) {
    bodyPayload.preparation_level = payload.preparation_level;
  }
  if (payload.mobility_level !== undefined) {
    bodyPayload.mobility_level = payload.mobility_level;
  }
  const res = await fetch(`${API_BASE}/api/profile/preparation`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
    },
    body: JSON.stringify(bodyPayload),
  });
  if (!res.ok) throw new Error("No se pudo guardar el nivel");
  const data = await res.json();
  return {
    preparation_level: (data.preparation_level ?? null) as PreparationLevel | null,
    mobility_level: (data.mobility_level ?? null) as MobilityLevel | null,
  };
}
