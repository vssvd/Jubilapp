from typing import Optional

ALLOWED_MOBILITY_LEVELS = {"baja", "media", "alta"}


def validate_mobility_level(level: Optional[str]) -> Optional[str]:
    if level is None:
        return None
    if isinstance(level, str):
        cleaned = level.strip().lower()
    else:
        cleaned = str(level).strip().lower()
    if not cleaned:
        return None
    if cleaned not in ALLOWED_MOBILITY_LEVELS:
        raise ValueError("Nivel de movilidad inválido")
    return cleaned

