from typing import List, Optional
from pydantic import BaseModel

class InterestOut(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    class Config:
        from_attributes = True  # Pydantic v2

class UserInterestsIn(BaseModel):
    interest_ids: List[int]

class UserInterestsOut(BaseModel):
    interests: List[InterestOut]

class UserInterestsByNamesIn(BaseModel):
    interest_names: List[str]
