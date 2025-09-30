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
        "name": "Jubilapp Eventos",
        "city": "Santiago",
        "lat": -33.4489,
        "lng": -70.6693,
        "url": "https://calendar.google.com/calendar/ical/1510ce0dffa41bbd00cc1933384cecd164789869e2dd88bb8be41b7237285020%40group.calendar.google.com/private-fe0ad891650695dd2f49abc97e99d25a/basic.ics",
        "country": "CL",
    },
]
