import { fetchMyInterests } from "./interests";
import { fetchPreparation } from "./preparation";

/** true si el usuario tiene al menos un interés guardado */
export async function hasInterests(): Promise<boolean> {
  try {
    const mine = await fetchMyInterests();
    return Array.isArray(mine) && mine.length > 0;
  } catch {
    return false;
  }
}

/** true si NO tiene nivel de preparación aún */
export async function needsPreparation(): Promise<boolean> {
  try {
    const level = await fetchPreparation(); // "planificado" | "intermedio" | "desorientado" | null
    return level == null;
  } catch {
    // si falla, asumimos que falta (para empujar al onboarding)
    return true;
  }
}

