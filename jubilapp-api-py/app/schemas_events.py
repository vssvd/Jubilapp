from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class Venue(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }


class EventItem(BaseModel):
    id: str
    title: str
    start_utc: Optional[str] = None
    end_utc: Optional[str] = None
    url: str
    currency: Optional[str] = None
    min_price: Optional[float] = None
    is_free: Optional[bool] = None
    image: Optional[str] = None
    venue: Optional[Venue] = None
    source: str

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
        "str_strip_whitespace": True,
    }


class EventsResponse(BaseModel):
    total: int
    items: List[EventItem]

    model_config = {
        "populate_by_name": True,
        "extra": "forbid",
    }
