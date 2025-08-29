from pydantic import BaseModel
from typing import List, Optional

class InterestOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    class Config: from_attributes = True  # Pydantic v2 (o orm_mode=True en v1)

class UserInterestsIn(BaseModel):
    interest_ids: List[int]

class UserInterestsOut(BaseModel):
    interests: List[InterestOut]
