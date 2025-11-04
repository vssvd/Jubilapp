from typing import List, Literal, Optional
from pydantic import BaseModel

EnergyLevel = Literal["baja", "media", "alta"]
CostLevel = Literal["gratis", "bajo", "medio", "alto"]
TimeOfDay = Literal["manana", "tarde", "noche", "cualquiera"]


class AtemporalActivityOut(BaseModel):
    id: int
    title: str
    emoji: str
    tags: List[str]
    indoor: bool
    energy: EnergyLevel
    duration_min: int
    cost: CostLevel
    time_of_day: TimeOfDay
    suggested_time: Optional[str] = None
    is_fallback: bool = False
    category: Optional[str] = None
    is_favorite: bool = False
    accessibility_labels: Optional[List[str]] = None


class AtemporalRecommendationsOut(BaseModel):
    activities: List[AtemporalActivityOut]
