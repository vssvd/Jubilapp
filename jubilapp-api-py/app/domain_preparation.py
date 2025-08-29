from typing import Optional

ALLOWED_LEVELS = {"planificado", "intermedio", "desorientado"}

def validate_level(level: Optional[str]) -> Optional[str]:
    if level is None:
        return None
    if level not in ALLOWED_LEVELS:
        raise ValueError("Nivel inválido")
    return level
