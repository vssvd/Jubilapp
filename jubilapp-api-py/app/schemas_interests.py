from typing import List, Optional
from pydantic import BaseModel

class Interest(BaseModel):
    id: str
    name: str
    category: Optional[str] = None

# <- ESTE nombre es el que pide interests.py
class InterestOut(Interest):
    pass

# Para guardar intereses del usuario (recibe IDs de intereses)
class UserInterestsIn(BaseModel):
    interest_ids: List[str]

# Para devolver al cliente la lista con objetos completos
class UserInterestsOut(BaseModel):
    interests: List[InterestOut]
