from __future__ import annotations

from typing import List, TypedDict


class ICSFeed(TypedDict, total=False):
    name: str
    city: str
    lat: float
    lng: float
    url: str
    country: str


FEEDS: List[ICSFeed] = [
    {
        "name": "Eventos Valparaíso",
        "city": "Valparaíso",
        "lat": -33.0458,
        "lng": -71.6197,
        "url": "https://storage.googleapis.com/jubilapp-22de9.firebasestorage.app/ics/eventos_valpo.ics",
        "country": "CL",
    },
]
