from typing import Optional, Literal
from pydantic import BaseModel

PreparationLevel = Literal["planificado", "intermedio", "desorientado"]
MobilityLevel = Literal["baja", "media", "alta"]

class PreparationOut(BaseModel):
    preparation_level: Optional[PreparationLevel] = None
    mobility_level: Optional[MobilityLevel] = None

class PreparationUpdate(BaseModel):
    preparation_level: Optional[PreparationLevel] = None
    mobility_level: Optional[MobilityLevel] = None
