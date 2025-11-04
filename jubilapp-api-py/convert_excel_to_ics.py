#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python <3.9
    ZoneInfo = None  # type: ignore[assignment]

from import_chilecultura_excel import (
    _clean_value as clean_value,
    _doc_id as build_doc_id,
    _load_records as load_records,
    _parse_datetime as parse_datetime,
)

SANTIAGO_TZ = ZoneInfo("America/Santiago") if ZoneInfo else None


def _escape_ics(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def _format_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        if SANTIAGO_TZ:
            value = value.replace(tzinfo=SANTIAGO_TZ)
        else:
            value = value.replace(tzinfo=timezone.utc)
    utc_value = value.astimezone(timezone.utc)
    return utc_value.strftime("%Y%m%dT%H%M%SZ")


def _format_allday(value: datetime) -> str:
    return value.strftime("%Y%m%d")


def _build_event(row: dict) -> Optional[List[str]]:
    title = clean_value(row.get("titulo") or row.get("title")) or "Evento"
    link = clean_value(row.get("link") or row.get("url"))
    location = clean_value(row.get("lugar")) or clean_value(row.get("ciudad_region"))
    description = clean_value(row.get("descripcion") or row.get("description"))

    fecha_inicio = clean_value(row.get("fecha_inicio") or row.get("start_date") or row.get("fecha"))
    hora_inicio = clean_value(row.get("hora_inicio") or row.get("hora"))
    fecha_fin = clean_value(row.get("fecha_fin") or row.get("end_date") or row.get("fecha_termino"))
    hora_fin = clean_value(row.get("hora_fin") or row.get("hora_termino") or row.get("end_time"))

    start_dt = parse_datetime(str(fecha_inicio) if fecha_inicio else None, str(hora_inicio) if hora_inicio else None)
    end_dt: Optional[datetime] = None
    if fecha_fin or hora_fin:
        end_dt = parse_datetime(str(fecha_fin) if fecha_fin else fecha_inicio, str(hora_fin) if hora_fin else None)

    if start_dt is None:
        return None

    is_all_day = not hora_inicio

    if end_dt and not is_all_day and end_dt <= start_dt:
        end_dt = end_dt + timedelta(days=1)

    uid_seed = build_doc_id(title, fecha_inicio, link or "")
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines: List[str] = [
        "BEGIN:VEVENT",
        f"UID:{uid_seed}@jubilapp",
        f"DTSTAMP:{now}",
    ]

    if is_all_day:
        lines.append(f"DTSTART;VALUE=DATE:{_format_allday(start_dt)}")
        if end_dt:
            # ICS all-day events use exclusive end date.
            exclusive_end = (end_dt + timedelta(days=1)).date()
            lines.append(f"DTEND;VALUE=DATE:{exclusive_end.strftime('%Y%m%d')}")
    else:
        lines.append(f"DTSTART:{_format_datetime(start_dt)}")
        if end_dt:
            lines.append(f"DTEND:{_format_datetime(end_dt)}")

    lines.append(f"SUMMARY:{_escape_ics(title)}")

    if description:
        lines.append(f"DESCRIPTION:{_escape_ics(description)}")
    if location:
        lines.append(f"LOCATION:{_escape_ics(location)}")
    if link:
        lines.append(f"URL:{_escape_ics(link)}")

    price_info = clean_value(row.get("precio_info") or row.get("precio"))
    if price_info:
        lines.append(f"X-JUBILAPP-PRICE:{_escape_ics(price_info)}")

    gratis = clean_value(row.get("es_gratis"))
    if gratis:
        lines.append(f"X-JUBILAPP-FREE:{_escape_ics(str(gratis))}")

    tags = clean_value(row.get("tags") or row.get("categoria"))
    if tags:
        lines.append(f"CATEGORIES:{_escape_ics(str(tags))}")

    lines.append("STATUS:CONFIRMED")
    lines.append("END:VEVENT")
    return lines


def _convert(paths: Iterable[Path]) -> Tuple[List[str], int]:
    events: List[str] = []
    total = 0
    seen_ids = set()
    for path in paths:
        for row in load_records(path):
            event_lines = _build_event(row)
            if not event_lines:
                continue
            uid_line = next((line for line in event_lines if line.startswith("UID:")), None)
            if uid_line and uid_line in seen_ids:
                continue
            if uid_line:
                seen_ids.add(uid_line)
            events.extend(event_lines)
            total += 1
    return events, total


def build_calendar(events: List[str]) -> str:
    header = [
        "BEGIN:VCALENDAR",
        "PRODID:-//Jubilapp//Eventos importados//ES",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    footer = ["END:VCALENDAR"]
    content = header + events + footer
    return "\r\n".join(content) + "\r\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Convierte planillas de eventos (ChileCultura) a un calendario ICS.")
    parser.add_argument("--input", "-i", nargs="+", required=True, help="Rutas .xlsx/.csv.")
    parser.add_argument("--output", "-o", required=True, help="Ruta del archivo .ics de salida.")
    args = parser.parse_args()

    input_paths = [Path(value).expanduser() for value in args.input]
    events, total = _convert(input_paths)
    calendar = build_calendar(events)

    output_path = Path(args.output).expanduser()
    output_path.write_text(calendar, encoding="utf-8")
    print(f"Archivo ICS generado: {output_path} ({total} eventos)")


if __name__ == "__main__":
    main()
