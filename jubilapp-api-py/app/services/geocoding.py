"""Lightweight Nominatim-based geocoder with in-memory cache."""

from __future__ import annotations

import asyncio
import hashlib
import time
from typing import Dict, Optional, Tuple

import httpx

UA = "jubilapp-geocoder/1.0 (+https://jubilapp.local)"
_CACHE: Dict[str, Tuple[float, Tuple[float, float]]] = {}
_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 días
_last_call: float = 0.0


def _ckey(query: str) -> str:
    return hashlib.sha1(query.strip().lower().encode()).hexdigest()


def _get_cache(query: str) -> Optional[Tuple[float, float]]:
    cached = _CACHE.get(_ckey(query))
    if cached and cached[0] > time.time():
        return cached[1]
    return None


def _set_cache(query: str, coords: Tuple[float, float]) -> None:
    _CACHE[_ckey(query)] = (time.time() + _TTL_SECONDS, coords)


async def _wait_rate_limit(min_delay: float = 1.0) -> None:
    global _last_call
    now = time.time()
    elapsed = now - _last_call
    if elapsed < min_delay:
        await asyncio.sleep(min_delay - elapsed)
    _last_call = time.time()


async def geocode_text(location_text: str) -> Optional[Tuple[float, float]]:
    """Resolve a location string to coordinates using Nominatim."""
    if not location_text:
        return None

    query = location_text.strip()
    if not query:
        return None
    if "chile" not in query.lower():
        query = f"{query}, Chile"

    if cached := _get_cache(query):
        return cached

    await _wait_rate_limit()

    headers = {"User-Agent": UA, "Accept-Language": "es"}
    params = {
        "q": query,
        "format": "jsonv2",
        "limit": 1,
        "countrycodes": "cl",
        "dedupe": 1,
        "addressdetails": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
            response = await client.get("https://nominatim.openstreetmap.org/search", params=params)
    except httpx.HTTPError:
        return None

    if response.status_code != 200:
        return None

    try:
        payload = response.json()
    except ValueError:
        return None

    if not isinstance(payload, list) or not payload:
        return None

    first = payload[0]
    try:
        lat = float(first["lat"])
        lon = float(first["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    coords = (lat, lon)
    _set_cache(query, coords)
    return coords
