from typing import Optional, Literal
from pydantic import BaseModel

PreparationLevel = Literal["planificado", "intermedio", "desorientado"]

class PreparationOut(BaseModel):
    preparation_level: Optional[PreparationLevel] = None

class PreparationUpdate(BaseModel):
    preparation_level: PreparationLevel
