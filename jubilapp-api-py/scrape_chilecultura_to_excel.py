#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scrape ChileCultura (https://chilecultura.gob.cl) events into an Excel/CSV file.
- Respects robots.txt and polite rate limiting.
- Paginates the "search" listing and then visits each event page for details.
- Filters: you can set FREE_ONLY, REGION, and a MAX_PAGES cap for demos.
USO:
  python scrape_chilecultura_to_excel.py --free --region "Valparaíso" --max-pages 5 --out eventos_chilecultura.xlsx
"""
import argparse
import csv
import json
import time
import re
import unicodedata
from dataclasses import dataclass, asdict, field
from typing import Optional, List, Tuple, Dict, Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://chilecultura.gob.cl"
LISTING = BASE + "/events/search/"
HEADERS = {
    "User-Agent": "JubilApp-scraper/1.0 (+https://example.local)",
    "Accept-Language": "es-CL,es;q=0.9"
}

# --- Polite settings ---
REQUEST_DELAY = 1.0  # seconds between requests (adjust if needed)
TIMEOUT = 12

FREE_KEYWORDS = (
    "gratis",
    "gratuito",
    "gratuita",
    "entrada liberada",
    "liberada",
    "libre de costo",
    "sin costo",
    "sin valor",
    "sin entrada",
)
REGION_FIELDS = ("titulo", "lugar", "ciudad_region")

# --- Helpers ---
def fetch(url: str) -> Optional[str]:
    time.sleep(REQUEST_DELAY)
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    if r.status_code == 200:
        return r.text
    return None

def norm_text(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def normalize_for_match(value: Optional[str]) -> str:
    """Lowercase + strip + remove diacritics to ease substring matching."""
    if not value:
        return ""
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return value.lower().strip()

def build_region_terms(region: Optional[str], aliases: Optional[List[str]] = None) -> Tuple[List[str], List[str]]:
    """Return (original_terms, normalized_terms) including basic variants."""
    raw_terms: List[str] = []
    if region:
        raw_terms.extend(region.split(","))
    if aliases:
        for alias in aliases:
            raw_terms.extend(alias.split(","))
    cleaned = []
    for term in raw_terms:
        term = term.strip()
        if term:
            cleaned.append(term)
    seen_norm = set()
    normalized_terms: List[str] = []
    for term in cleaned:
        variants = [term]
        lower = term.lower()
        if lower.startswith("región de "):
            variants.append(term[10:])
        if lower.startswith("region de "):
            variants.append(term[10:])
        for variant in variants:
            norm_variant = normalize_for_match(variant)
            if norm_variant and norm_variant not in seen_norm:
                seen_norm.add(norm_variant)
                normalized_terms.append(norm_variant)
    return cleaned, normalized_terms

def passes_region_filter(item: "EventItem", normalized_terms: List[str]) -> bool:
    if not normalized_terms:
        return True
    candidates = []
    for field_name in REGION_FIELDS:
        candidates.append(getattr(item, field_name, ""))
    candidates.append(item.search_blob)
    for candidate in candidates:
        norm_value = normalize_for_match(candidate)
        if not norm_value:
            continue
        for term in normalized_terms:
            if term in norm_value:
                return True
    return False

def deduplicate_items(items: List["EventItem"]) -> List["EventItem"]:
    deduped: List[EventItem] = []
    seen = set()
    for item in items:
        key = (normalize_for_match(item.titulo), item.fecha_inicio, item.link or "")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped

def find_next_page(soup: BeautifulSoup) -> Optional[str]:
    # Look for pagination "»" or rel="next"
    a = soup.find("a", rel="next")
    if a and a.get("href"):
        return urljoin(BASE, a["href"])
    # fallback: last "»" link
    for a in soup.select("a"):
        if a.get_text(strip=True) in {">", "»", "Siguiente", "Next"} and a.get("href"):
            return urljoin(BASE, a["href"])
    return None

def extract_event_links_from_listing(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links = set()
    # typical cards linking to /events/<id>/
    for a in soup.select("a"):
        href = a.get("href", "")
        if not href:
            continue
        href = href.strip()
        if not href.startswith("/events/"):
            continue
        if href.startswith("/events/search"):
            continue
        normalized_href = href.split("#", 1)[0].split("?", 1)[0].rstrip("/")
        if normalized_href == "/events":
            continue
        if normalized_href:
            links.add(urljoin(BASE, normalized_href + "/"))
    return sorted(links)

def load_jsonld(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    payloads: List[Dict[str, Any]] = []
    for script in soup.find_all("script", type="application/ld+json"):
        text = script.string
        if not text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            for entry in data:
                if isinstance(entry, dict):
                    payloads.append(entry)
        elif isinstance(data, dict):
            payloads.append(data)
    return payloads

def ensure_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    return [value] if value is not None else []

@dataclass
class EventItem:
    titulo: str = ""
    lugar: str = ""
    ciudad_region: str = ""
    descripcion: str = ""
    fecha_inicio: str = ""
    hora_inicio: str = ""
    fecha_fin: str = ""
    hora_fin: str = ""
    precio_info: str = ""
    es_gratis: bool = False
    link: str = ""
    search_blob: str = field(default="", repr=False, compare=False)

EXPORT_FIELDS = [name for name in EventItem.__dataclass_fields__.keys() if name != "search_blob"]

def parse_event_page(html: str, url: str) -> EventItem:
    soup = BeautifulSoup(html, "html.parser")
    item = EventItem(link=url)

    jsonld_entries = load_jsonld(soup)
    event_ld: Optional[Dict[str, Any]] = None
    for entry in jsonld_entries:
        types = ensure_list(entry.get("@type"))
        if any("Event" == t or t.endswith("Event") for t in types if isinstance(t, str)):
            event_ld = entry
            break

    # Title
    h1 = soup.find(["h1","h2"])
    if h1: item.titulo = norm_text(h1.get_text())
    if event_ld:
        item.titulo = item.titulo or norm_text(event_ld.get("name"))

    # Region / location hints (site layout may vary)
    # Look for labels or icon-text pairs
    # Many pages include "Región ..." or an address block
    # We'll gather text from common containers:
    meta_blocks = []
    for sel in ["section", "div"]:
        for el in soup.select(f"{sel}.event-meta, {sel}.evento-meta, {sel}.meta, {sel}.event-info, {sel}.evento-info"):
            meta_blocks.append(norm_text(el.get_text(" ")))
    meta_blocks.extend(norm_text(el.get_text(" ")) for el in soup.select(".breadcrumb, .breadcrumbs, .chips, .tags, .event-tags"))
    meta_blocks.extend(norm_text(el.get_text(" ")) for el in soup.select("address"))
    page_text = norm_text(soup.get_text(" "))

    # Ciudad/Región heuristic
    m = re.search(r"Regi[oó]n\s+de\s+([A-Za-zÁÉÍÓÚÑñ\s]+)", page_text)
    if m:
        item.ciudad_region = "Región de " + m.group(1).strip()
    if event_ld:
        location = event_ld.get("location")
        location_list = ensure_list(location)
        for location_entry in location_list:
            if not isinstance(location_entry, dict):
                continue
            loc_name = norm_text(location_entry.get("name"))
            if loc_name and not item.lugar:
                item.lugar = loc_name
            address = location_entry.get("address")
            if isinstance(address, dict):
                locality = norm_text(address.get("addressLocality"))
                region = norm_text(address.get("addressRegion"))
                addr_line = norm_text(address.get("streetAddress"))
                components = [comp for comp in [locality, region] if comp]
                if components:
                    item.ciudad_region = ", ".join(components)
                if addr_line and not item.lugar:
                    item.lugar = addr_line
            if item.ciudad_region:
                break
    if not item.ciudad_region:
        for block in meta_blocks:
            m_region = re.search(r"(Regi[oó]n(?:\s+de)?\s+[A-Za-zÁÉÍÓÚÑñ\s]+)", block)
            if m_region:
                item.ciudad_region = norm_text(m_region.group(1))
                break

    # Lugar: look for "Lugar:" or similar
    m2 = re.search(r"(Lugar|Ubicaci[oó]n)\s*:\s*(.+?)(?:\s{2,}|$)", page_text)
    if m2:
        item.lugar = m2.group(2).strip()
    if not item.lugar:
        for block in meta_blocks:
            m_loc = re.search(r"(Lugar|Ubicaci[oó]n)\s*[:\-]\s*(.+)", block, re.IGNORECASE)
            if m_loc:
                item.lugar = m_loc.group(2).strip()
                break
    if event_ld and not item.lugar:
        location = event_ld.get("location")
        for loc in ensure_list(location):
            if isinstance(loc, dict):
                loc_name = norm_text(loc.get("name"))
                if loc_name:
                    item.lugar = loc_name
                    break

    # Description: take the first paragraph-like block under a description section
    desc = ""
    for sel in ["#descripcion", ".descripcion", ".description", ".content", ".entry-content"]:
        el = soup.select_one(sel)
        if el:
            desc = norm_text(el.get_text(" "))
            break
    if not desc:
        # fallback: first long paragraph
        ps = [p for p in soup.find_all("p") if len(p.get_text(strip=True)) > 60]
        if ps:
            desc = norm_text(ps[0].get_text(" "))
    item.descripcion = desc
    if event_ld and event_ld.get("description"):
        ld_desc = norm_text(event_ld["description"])
        if ld_desc:
            item.descripcion = ld_desc

    # Dates / times (heuristics)
    # We'll search for typical date blocks like "desde 28 oct" or "2025-10-28" etc.
    # Prefer machine-readable meta if available
    dtstart = soup.find("time", {"itemprop": "startDate"}) or soup.find("time", {"datetime": True})
    dtend   = soup.find("time", {"itemprop": "endDate"})
    def split_dt(t: Optional[str]):
        if not t: return ("","")
        t = t.strip()
        # ISO like 2025-10-28T18:00
        m = re.match(r"(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})", t)
        if m: return (m.group(1), m.group(2))
        # Fallback: try to extract time like "18:00"
        tm = re.search(r"(\d{1,2}:\d{2})", t)
        d  = re.search(r"(\d{4}-\d{2}-\d{2})", t)
        return (d.group(1) if d else "", tm.group(1) if tm else "")
    if dtstart and dtstart.has_attr("datetime"):
        item.fecha_inicio, item.hora_inicio = split_dt(dtstart["datetime"])
    if dtend and dtend.has_attr("datetime"):
        item.fecha_fin, item.hora_fin = split_dt(dtend["datetime"])
    if event_ld:
        if not item.fecha_inicio or not item.hora_inicio:
            start = event_ld.get("startDate")
            if start:
                start_date, start_time = split_dt(start)
                item.fecha_inicio = item.fecha_inicio or start_date
                item.hora_inicio = item.hora_inicio or start_time
        if not item.fecha_fin or not item.hora_fin:
            end = event_ld.get("endDate")
            if end:
                end_date, end_time = split_dt(end)
                item.fecha_fin = item.fecha_fin or end_date
                item.hora_fin = item.hora_fin or end_time

    # Precio / gratis
    normalized_page = normalize_for_match(page_text)
    badges = [normalize_for_match(norm_text(b.get_text(" "))) for b in soup.select(".badge, .tag, .chip, .etiqueta")]
    item.es_gratis = any(keyword in normalized_page for keyword in FREE_KEYWORDS) or any(
        "gratis" in badge or "liberada" in badge for badge in badges
    )
    # Try to capture a price line if present
    mprice = re.search(r"(\$|clp)\s*\d[\d\.]*", page_text, re.IGNORECASE)
    if mprice:
        item.precio_info = mprice.group(0)
    if item.es_gratis and not item.precio_info:
        item.precio_info = "Gratis"
    if event_ld:
        offers = ensure_list(event_ld.get("offers"))
        for offer in offers:
            if not isinstance(offer, dict):
                continue
            price = offer.get("price")
            if price in (None, "", "0", "0.0", 0, 0.0):
                item.es_gratis = True
                item.precio_info = item.precio_info or "Gratis"
            elif isinstance(price, (int, float)):
                item.precio_info = item.precio_info or f"{offer.get('priceCurrency','CLP')} {price}"
            elif isinstance(price, str):
                price_str = norm_text(price)
                if price_str:
                    item.precio_info = item.precio_info or price_str

    # If still missing location, try structured pieces near icons
    if not item.lugar:
        # look for an address-like line
        maddr = re.search(r"(calle|plaza|teatro|museo|parque|biblioteca|centro cultural)[^\.]{10,80}", page_text, re.IGNORECASE)
        if maddr:
            item.lugar = norm_text(maddr.group(0))

    extra_blobs = meta_blocks + [item.descripcion, page_text]
    if event_ld:
        json_blob_parts = []
        for key in ("name", "description"):
            value = event_ld.get(key)
            if isinstance(value, str):
                json_blob_parts.append(value)
        location = event_ld.get("location")
        for loc in ensure_list(location):
            if isinstance(loc, dict):
                json_blob_parts.extend(str(v) for v in loc.values() if isinstance(v, str))
        extra_blobs.append(" ".join(json_blob_parts))
    item.search_blob = " ".join(extra_blobs)
    return item

def event_to_dict(item: EventItem) -> Dict[str, str]:
    data = asdict(item)
    data.pop("search_blob", None)
    return data

def build_listing_url(page:int=1, free_only:bool=False, region:Optional[str]=None) -> str:
    # Base listing supports query params. We know "free=on" works.
    params = []
    if free_only:
        params.append("free=on")
    if region:
        # The site may use slugs; as a heuristic, try a generic "q=" filter too.
        params.append("q=" + requests.utils.quote(region))
    if page > 1:
        params.append(f"page={page}")
    qs = ("?" + "&".join(params)) if params else ""
    return LISTING + qs

def scrape(max_pages:int=3, free_only:bool=True, region:Optional[str]=None) -> List[EventItem]:
    items: List[EventItem] = []
    page = 1
    next_url = build_listing_url(page=page, free_only=free_only, region=region)

    visited_links = set()

    while next_url and page <= max_pages:
        html = fetch(next_url)
        if not html:
            break
        links = extract_event_links_from_listing(html)
        # Visit each event page
        for href in links:
            if href in visited_links:
                continue
            visited_links.add(href)
            ev_html = fetch(href)
            if not ev_html:
                continue
            item = parse_event_page(ev_html, href)
            items.append(item)
        # Find next page
        soup = BeautifulSoup(html, "html.parser")
        next_link = find_next_page(soup)
        next_url = next_link
        page += 1
    return items

def write_excel(items: List[EventItem], out_path: str):
    try:
        import pandas as pd
    except ImportError:
        raise SystemExit("Pandas no está instalado. Ejecuta: pip install pandas openpyxl")
    data = [event_to_dict(i) for i in items]
    df = pd.DataFrame(data, columns=EXPORT_FIELDS)
    df.to_excel(out_path, index=False)

def write_csv(items: List[EventItem], out_path: str):
    fieldnames = EXPORT_FIELDS
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for it in items:
            w.writerow(event_to_dict(it))

def main():
    ap = argparse.ArgumentParser(description="Scrape ChileCultura events to Excel/CSV")
    ap.add_argument("--region", type=str, default=None, help="Filtrar por región/ciudad (texto libre)")
    ap.add_argument(
        "--regions",
        type=str,
        nargs="*",
        default=None,
        help="Términos adicionales para la región (puedes repetir el flag o usar comas).",
    )
    ap.add_argument("--free", action="store_true", help="Sólo eventos gratis (equivale a free=on)")
    ap.add_argument("--max-pages", type=int, default=3, help="Límite de páginas para recorrer (demostración)")
    ap.add_argument("--out", type=str, default="eventos_chilecultura.xlsx", help="Ruta de salida (.xlsx o .csv)")
    args = ap.parse_args()

    original_terms, normalized_terms = build_region_terms(args.region, args.regions)
    region_for_listing = args.region
    if not region_for_listing and original_terms:
        region_for_listing = original_terms[0]

    items = scrape(max_pages=args.max_pages, free_only=args.free, region=region_for_listing)
    total_scraped = len(items)
    if not total_scraped:
        print("No se encontraron eventos en la paginación consultada.")
        return

    items = deduplicate_items(items)
    after_dedup = len(items)

    if normalized_terms:
        items = [it for it in items if passes_region_filter(it, normalized_terms)]
    after_region = len(items)

    if args.free:
        items = [it for it in items if it.es_gratis]
    after_free = len(items)
    final_total = len(items)

    print(f"Eventos descargados: {total_scraped}")
    if after_dedup != total_scraped:
        print(f"Tras eliminar duplicados: {after_dedup}")
    if normalized_terms:
        display_terms = ", ".join(original_terms) if original_terms else "(normalizado)"
        print(f"Tras filtrar región ({display_terms}): {after_region}")
    if args.free:
        print(f"Tras filtrar gratuitos: {after_free}")

    if not final_total:
        print("No quedaron eventos tras aplicar los filtros. Se generará un archivo vacío con el esquema esperado.")

    if args.out.lower().endswith(".csv"):
        write_csv(items, args.out)
    else:
        write_excel(items, args.out)

    print(f"Archivo guardado en {args.out} (total final: {final_total})")

if __name__ == "__main__":
    main()
