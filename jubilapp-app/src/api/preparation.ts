// src/api/preparation.ts
import { authHeader, API_BASE } from "./client";

export type PreparationLevel = "planificado" | "intermedio" | "desorientado";

export async function fetchPreparation(): Promise<PreparationLevel | null> {
  const res = await fetch(`${API_BASE}/api/profile/preparation`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error("No se pudo cargar el nivel");
  const data = await res.json();
  return (data.preparation_level ?? null) as PreparationLevel | null;
}

export async function savePreparation(level: PreparationLevel): Promise<PreparationLevel> {
  const res = await fetch(`${API_BASE}/api/profile/preparation`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
    },
    body: JSON.stringify({ preparation_level: level }),
  });
  if (!res.ok) throw new Error("No se pudo guardar el nivel");
  const data = await res.json();
  return data.preparation_level as PreparationLevel;
} 