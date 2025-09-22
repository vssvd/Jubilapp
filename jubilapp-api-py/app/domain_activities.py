from __future__ import annotations

from typing import List, Dict, Optional
import random

# Catálogo de actividades atemporales.
# Tags deben corresponder a los nombres del catálogo de intereses
# definido en routers/interests.py → BASE_CATALOG.
ATEMPORAL_ACTIVITIES: List[Dict] = [
    {"id": 1, "title": "Caminata ligera por tu sector", "emoji": "🚶", "tags": ["Caminatas / trekking"], "indoor": False, "energy": "media", "duration_min": 30, "cost": "gratis", "time_of_day": "manana"},
    {"id": 2, "title": "Yoga suave en casa", "emoji": "🧘", "tags": ["Gimnasia suave / yoga / pilates"], "indoor": True, "energy": "baja", "duration_min": 20, "cost": "gratis", "time_of_day": "manana"},
    {"id": 3, "title": "Sesión de estiramientos guiados", "emoji": "🤸", "tags": ["Gimnasia suave / yoga / pilates"], "indoor": True, "energy": "baja", "duration_min": 15, "cost": "gratis", "time_of_day": "manana"},
    {"id": 4, "title": "Pintura creativa", "emoji": "🎨", "tags": ["Pintura / Dibujo"], "indoor": True, "energy": "baja", "duration_min": 45, "cost": "bajo", "time_of_day": "tarde"},
    {"id": 5, "title": "Escribir un recuerdo de tu vida", "emoji": "✍️", "tags": ["Escritura / lectura creativa"], "indoor": True, "energy": "baja", "duration_min": 20, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 6, "title": "Escucha tu álbum favorito", "emoji": "🎵", "tags": ["Música (escuchar, cantar, tocar instrumento)"], "indoor": True, "energy": "baja", "duration_min": 30, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 7, "title": "Organiza y digitaliza fotos antiguas", "emoji": "🗂️", "tags": ["Fotografía", "Historia y cultura"], "indoor": True, "energy": "baja", "duration_min": 40, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 8, "title": "Practica vocabulario de un idioma", "emoji": "🗣️", "tags": ["Idiomas"], "indoor": True, "energy": "baja", "duration_min": 15, "cost": "gratis", "time_of_day": "manana"},
    {"id": 9, "title": "Cocina una receta saludable", "emoji": "🥗", "tags": ["Cocina saludable"], "indoor": True, "energy": "media", "duration_min": 45, "cost": "medio", "time_of_day": "tarde"},
    {"id": 10, "title": "Jardinería: plantar o regar", "emoji": "🪴", "tags": ["Jardinería"], "indoor": False, "energy": "baja", "duration_min": 25, "cost": "bajo", "time_of_day": "manana"},
    {"id": 11, "title": "Club de lectura personal", "emoji": "📚", "tags": ["Club de lectura"], "indoor": True, "energy": "baja", "duration_min": 30, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 12, "title": "Juego de mesa o cartas", "emoji": "🃏", "tags": ["Juegos de mesa / cartas"], "indoor": True, "energy": "baja", "duration_min": 30, "cost": "bajo", "time_of_day": "noche"},
    {"id": 13, "title": "Videollamada con familia o amigos", "emoji": "📱", "tags": ["Videollamadas con familia / amigos"], "indoor": True, "energy": "baja", "duration_min": 20, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 14, "title": "Meditación guiada 10 minutos", "emoji": "🧘‍♂️", "tags": ["Meditación / mindfulness"], "indoor": True, "energy": "baja", "duration_min": 10, "cost": "gratis", "time_of_day": "manana"},
    {"id": 15, "title": "Curso corto online (20–30m)", "emoji": "💻", "tags": ["Cursos online / talleres", "Tecnología (apps, redes sociales)", "Fotografía y edición digital"], "indoor": True, "energy": "media", "duration_min": 30, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 16, "title": "Visita un museo virtual", "emoji": "🖼️", "tags": ["Museos, teatro, cine", "Historia y cultura"], "indoor": True, "energy": "baja", "duration_min": 30, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 17, "title": "Baile suave con tu música", "emoji": "💃", "tags": ["Baile", "Música (escuchar, cantar, tocar instrumento)"], "indoor": True, "energy": "media", "duration_min": 20, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 18, "title": "Paseo en bicicleta corta", "emoji": "🚲", "tags": ["Ciclismo"], "indoor": False, "energy": "alta", "duration_min": 30, "cost": "gratis", "time_of_day": "manana"},
    {"id": 19, "title": "Voluntariado digital (microtareas)", "emoji": "🤝", "tags": ["Voluntariado", "Tecnología (apps, redes sociales)"] , "indoor": True, "energy": "baja", "duration_min": 30, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 20, "title": "Aprende una app de salud", "emoji": "📲", "tags": ["Apps de finanzas, salud, transporte", "Tecnología (apps, redes sociales)"], "indoor": True, "energy": "baja", "duration_min": 25, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 21, "title": "Comparte una foto en redes", "emoji": "📷", "tags": ["Redes sociales", "Fotografía y edición digital"], "indoor": True, "energy": "baja", "duration_min": 15, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 22, "title": "Juego digital de lógica", "emoji": "🧩", "tags": ["Juegos digitales (apps, consolas, PC)"], "indoor": True, "energy": "media", "duration_min": 20, "cost": "gratis", "time_of_day": "noche"},
    {"id": 23, "title": "Leer un cuento con tus nietos", "emoji": "👨‍👩‍👧‍👦", "tags": ["Actividades con nietos / familia"], "indoor": True, "energy": "baja", "duration_min": 20, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 24, "title": "Autocuidado: rutina facial simple", "emoji": "🧴", "tags": ["Autocuidado (skincare, spa casero, etc.)"], "indoor": True, "energy": "baja", "duration_min": 15, "cost": "bajo", "time_of_day": "noche"},
    {"id": 25, "title": "Agenda tu control de salud", "emoji": "🗓️", "tags": ["Control de salud / chequeos"], "indoor": True, "energy": "baja", "duration_min": 10, "cost": "gratis", "time_of_day": "manana"},
    {"id": 26, "title": "Plan de paseo local", "emoji": "🗺️", "tags": ["Viajes y turismo local"], "indoor": False, "energy": "media", "duration_min": 30, "cost": "gratis", "time_of_day": "tarde"},
    {"id": 27, "title": "Sesión corta de natación", "emoji": "🏊", "tags": ["Natación"], "indoor": False, "energy": "alta", "duration_min": 30, "cost": "medio", "time_of_day": "tarde"},
    {"id": 28, "title": "Pesca en lago o río", "emoji": "🎣", "tags": ["Pesca"], "indoor": False, "energy": "baja", "duration_min": 90, "cost": "medio", "time_of_day": "manana"},
]


def _energy_weight(level: Optional[str], energy: str) -> int:
    if level == "desorientado":
        return {"baja": 4, "media": 1, "alta": -3}.get(energy, 0)
    if level == "intermedio":
        return {"baja": 2, "media": 3, "alta": 0}.get(energy, 0)
    if level == "planificado":
        return {"baja": 0, "media": 2, "alta": 3}.get(energy, 0)
    return 0


def _duration_weight(level: Optional[str], minutes: int) -> int:
    if level == "desorientado":
        return 1 if minutes <= 30 else (-1 if minutes > 45 else 0)
    if level == "intermedio":
        return 1 if 20 <= minutes <= 60 else 0
    if level == "planificado":
        return 1 if 30 <= minutes <= 90 else 0
    return 0


def _time_weight(pref: Optional[str], tod: str) -> int:
    if not pref or pref == "cualquiera":
        return 0
    return 1 if pref == tod else 0


def recommend_atemporales(
    user_interests: List[str],
    preparation_level: Optional[str] = None,
    *,
    limit: int = 10,
    time_of_day: Optional[str] = None,
) -> List[Dict]:
    names = {n.strip() for n in user_interests if n and n.strip()}

    scored = []
    for a in ATEMPORAL_ACTIVITIES:
        overlap = len(names.intersection(set(a.get("tags", []))))
        base = overlap * 10  # match de intereses pesa fuerte

        score = base
        score += _energy_weight(preparation_level, a["energy"])  # ajuste por energía
        score += _duration_weight(preparation_level, a["duration_min"])  # preferencia por duración
        score += 1 if a.get("cost") == "gratis" else 0
        score += _time_weight(time_of_day, a.get("time_of_day", "cualquiera"))

        # Preferencia suave por indoor cuando el nivel es desorientado
        if preparation_level == "desorientado" and a.get("indoor"):
            score += 1

        # Pequeño ruido para variedad (±0.5)
        score += random.uniform(-0.5, 0.5)

        scored.append((score, a))

    scored.sort(key=lambda x: x[0], reverse=True)
    out = [s[1] for s in scored[: max(1, limit)]]

    # Recomendar hora sugerida por time_of_day si no viene
    def suggest_time(tod: str) -> str:
        return {
            "manana": "10:00",
            "tarde": "16:00",
            "noche": "19:00",
        }.get(tod, "16:00")

    for a in out:
        if not a.get("suggested_time"):
            a["suggested_time"] = suggest_time(a.get("time_of_day", "cualquiera"))

    return out

