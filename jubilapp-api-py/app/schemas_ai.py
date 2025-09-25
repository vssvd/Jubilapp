from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class QuestionnaireIn(BaseModel):
    interest_answers: List[str] = Field(default_factory=list)
    preparation_answer: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=10)
    store: bool = False
    session_id: Optional[str] = None


class SuggestedInterest(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    score: float


class QuestionnaireOut(BaseModel):
    interests: List[SuggestedInterest]
    preparation_level: Optional[str] = None
    applied: bool = False
    session_id: Optional[str] = None
