#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Importa eventos previamente extraídos de ChileCultura (Excel/CSV) a la colección
`activities` de Firestore usada por JubilApp.

Uso básico:
    python import_chilecultura_excel.py --input eventos_valpo.xlsx eventos_iquique.xlsx

Requisitos:
- Variables de entorno FIREBASE_CREDENTIALS (y opcionalmente FIREBASE_STORAGE_BUCKET)
  configuradas igual que para el resto del backend.
- Dependencias: pandas, openpyxl (para Excel) o equivalente.
"""
from __future__ import annotations

import argparse
import csv
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import md5
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from xml.etree import ElementTree as ET

try:
    import pandas as pd  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - dependencia opcional
    pd = None  # type: ignore[assignment]

from firebase_admin import firestore

from app.firebase import db

KEYWORD_INTERESTS: List[Tuple[str, str]] = [
    ("yoga", "Gimnasia suave / yoga / pilates"),
    ("pilates", "Gimnasia suave / yoga / pilates"),
    ("camin", "Caminatas / trekking"),
    ("trek", "Caminatas / trekking"),
    ("museo", "Museos, teatro, cine"),
    ("teatro", "Museos, teatro, cine"),
    ("cine", "Museos, teatro, cine"),
    ("concierto", "Música (escuchar, cantar, tocar instrumento)"),
    ("musica", "Música (escuchar, cantar, tocar instrumento)"),
    ("baile", "Baile"),
    ("danza", "Baile"),
    ("gastr", "Gastronomía (recetas, restaurantes)"),
    ("feria", "Eventos culturales y ferias"),
    ("expo", "Eventos culturales y ferias"),
    ("volunt", "Voluntariado"),
    ("salud", "Control de salud / chequeos"),
    ("medit", "Meditación / mindfulness"),
    ("artesan", "Manualidades / artesanía"),
]


@dataclass
class ImportSummary:
    created: int = 0
    updated: int = 0
    skipped: int = 0

    def as_dict(self) -> Dict[str, int]:
        return {
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "total": self.created + self.updated,
        }


def _clean_value(value):
    if isinstance(value, str):
        value = value.strip()
        return value if value else None
    if pd is not None:
        try:
            if pd.isna(value):
                return None
        except TypeError:
            pass
    return value


def _parse_bool(value: object) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        text = value.strip().lower()
        if not text:
            return None
        if text in {"1", "true", "verdadero", "yes", "si", "sí", "gratis"}:
            return True
        if text in {"0", "false", "falso", "no"}:
            return False
    return None


def _parse_datetime(date_str: Optional[str], time_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    date_str = date_str.strip()
    if not date_str:
        return None
    dt_format_candidates = (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%Y/%m/%d",
        "%d/%m/%Y",
        "%d/%m/%y",
        "%d-%m-%y",
    )
    date_obj: Optional[datetime] = None
    for fmt in dt_format_candidates:
        try:
            date_obj = datetime.strptime(date_str, fmt)
            break
        except ValueError:
            continue
    if date_obj is None:
        # Excel serial number (days since 1899-12-30)
        try:
            serial = float(date_str)
        except ValueError:
            serial = None
        if serial is not None and serial > 0:
            excel_epoch = datetime(1899, 12, 30)
            date_obj = excel_epoch + timedelta(days=serial)
    if date_obj is None:
        return None
    if time_str:
        time_raw = time_str.strip().lower()
        time_clean = time_raw.replace(".", ":")
        suffix = None
        if time_clean.endswith(("am", "pm")):
            suffix = time_clean[-2:]
            time_clean = time_clean[:-2].strip()
        time_candidates = ("%H:%M", "%H%M")
        for tfmt in time_candidates:
            try:
                time_obj = datetime.strptime(time_clean, tfmt).time()
                return datetime.combine(date_obj.date(), time_obj)
            except ValueError:
                continue
        if suffix:
            for tfmt in ("%I:%M", "%I%M"):
                try:
                    time_obj = datetime.strptime(time_clean, tfmt).time()
                    hour = time_obj.hour
                    if suffix == "pm" and hour < 12:
                        hour += 12
                    if suffix == "am" and hour == 12:
                        hour = 0
                    time_obj = time_obj.replace(hour=hour)
                    return datetime.combine(date_obj.date(), time_obj)
                except ValueError:
                    continue
    return datetime.combine(date_obj.date(), datetime.min.time())


def _detect_tags(*chunks: Optional[str]) -> Optional[List[str]]:
    haystack = " ".join(chunk or "" for chunk in chunks).lower()
    tags: List[str] = []
    for keyword, interest in KEYWORD_INTERESTS:
        if keyword in haystack and interest not in tags:
            tags.append(interest)
        if len(tags) >= 3:
            break
    return tags or None


def _doc_id(titulo: Optional[str], fecha_inicio: Optional[str], link: Optional[str]) -> str:
    parts = [link or "", fecha_inicio or "", titulo or ""]
    seed = "||".join(parts).encode("utf-8", "ignore")
    digest = md5(seed).hexdigest()[:24]
    return f"chilecultura-{digest}"


def _column_index(cell_ref: str) -> int:
    match = re.match(r"([A-Za-z]+)", cell_ref or "")
    if not match:
        return 0
    letters = match.group(1).upper()
    index = 0
    for ch in letters:
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def _read_xlsx_without_pandas(path: Path) -> List[List[str]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            raw_shared = archive.read("xl/sharedStrings.xml")
            namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            shared_root = ET.fromstring(raw_shared)
            for entry in shared_root.findall("main:si", namespace):
                chunks: List[str] = []
                for node in entry.findall(".//main:t", namespace):
                    chunks.append(node.text or "")
                shared_strings.append("".join(chunks))

        sheet_name = "xl/worksheets/sheet1.xml"
        raw_sheet = archive.read(sheet_name)

    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(raw_sheet)
    rows: List[List[str]] = []

    for row in root.findall("main:sheetData/main:row", namespace):
        values: List[str] = []
        for cell in row.findall("main:c", namespace):
            ref = cell.get("r") or ""
            index = max(_column_index(ref), 0)
            while len(values) <= index:
                values.append("")

            cell_type = cell.get("t")
            value = ""
            if cell_type == "inlineStr":
                pieces = []
                for node in cell.findall(".//main:t", namespace):
                    pieces.append(node.text or "")
                value = "".join(pieces)
            else:
                raw_value = cell.find("main:v", namespace)
                text = raw_value.text if raw_value is not None else None
                if cell_type == "s" and text and text.isdigit():
                    try:
                        value = shared_strings[int(text)]
                    except (IndexError, ValueError):
                        value = text
                elif text is not None:
                    value = text
            values[index] = value
        rows.append(values)

    return rows


def _load_records(path: Path) -> List[Dict[str, object]]:
    suffix = path.suffix.lower()
    raw_rows: List[Dict[str, object]] = []

    if suffix in {".xls", ".xlsx"} and pd is not None:
        df = pd.read_excel(path)
        raw_rows = df.to_dict(orient="records")
    elif suffix in {".xls", ".xlsx"}:
        rows = _read_xlsx_without_pandas(path)
        if not rows:
            return []
        header = [col.strip() for col in rows[0]]
        for row in rows[1:]:
            record: Dict[str, object] = {}
            for idx, key in enumerate(header):
                if not key:
                    continue
                record[key] = row[idx] if idx < len(row) else None
            raw_rows.append(record)
    elif pd is not None:
        df = pd.read_csv(path)
        raw_rows = df.to_dict(orient="records")
    else:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            raw_rows = list(reader)

    records: List[Dict[str, object]] = []
    for raw in raw_rows:
        cleaned = {key: _clean_value(value) for key, value in raw.items()}
        records.append(cleaned)
    return records


def _build_payload(row: Dict[str, object]) -> Tuple[Optional[Dict[str, object]], Optional[str]]:
    titulo = row.get("titulo") or row.get("title")
    link = row.get("link") or row.get("url")
    ciudad_region = row.get("ciudad_region") or row.get("ciudadRegion")
    lugar = row.get("lugar") or row.get("venue")
    descripcion = row.get("descripcion") or row.get("description")
    fecha_inicio = row.get("fecha_inicio") or row.get("start_date") or row.get("fecha")
    hora_inicio = row.get("hora_inicio") or row.get("hora")
    fecha_fin = row.get("fecha_fin") or row.get("end_date") or row.get("fecha_termino")
    hora_fin = row.get("hora_fin") or row.get("hora_termino") or row.get("end_time")
    es_gratis = _parse_bool(row.get("es_gratis"))
    precio_info = row.get("precio_info") or row.get("precio")

    if not titulo:
        return None, "sin título"

    start_dt = _parse_datetime(str(fecha_inicio) if fecha_inicio else None, str(hora_inicio) if hora_inicio else None)
    end_dt = _parse_datetime(str(fecha_fin) if fecha_fin else None, str(hora_fin) if hora_fin else None) if fecha_fin else None

    # Fallback: si faltan datos clave, volver a scrapear el detalle
    should_refetch = (start_dt is None) or (es_gratis is None) or not ciudad_region or not lugar
    if should_refetch and link:
        try:
            from scrape_chilecultura_to_excel import fetch, parse_event_page
        except Exception:  # noqa: BLE001 - import fallback
            fetch = parse_event_page = None  # type: ignore[assignment]
        if fetch and parse_event_page:
            try:
                html = fetch(str(link))
            except Exception:
                html = None
            if html:
                try:
                    event = parse_event_page(html, str(link))
                except Exception:
                    event = None
                if event:
                    if start_dt is None:
                        start_dt = _parse_datetime(event.fecha_inicio or None, event.hora_inicio or None)
                    if end_dt is None and (event.fecha_fin or event.hora_fin):
                        end_dt = _parse_datetime(event.fecha_fin or None, event.hora_fin or None)
                    if es_gratis is None and event.es_gratis is not None:
                        es_gratis = bool(event.es_gratis)
                    if not precio_info and event.precio_info:
                        precio_info = event.precio_info
                    if not ciudad_region and event.ciudad_region:
                        ciudad_region = event.ciudad_region
                    if not lugar and event.lugar:
                        lugar = event.lugar
                    if not descripcion and event.descripcion:
                        descripcion = event.descripcion

    if start_dt is None:
        return None, "sin fecha de inicio"

    payload: Dict[str, object] = {
        "type": "event",
        "title": titulo,
        "category": None,
        "dateTime": start_dt,
        "location": lugar or ciudad_region,
        "link": link,
        "origin": "chilecultura",
        "description": descripcion,
        "isFree": es_gratis if es_gratis is not None else None,
        "currency": None,
        "minPrice": None,
        "image": None,
        "region": ciudad_region,
        "source": {
            "type": "chilecultura",
            "link": link,
            "region": ciudad_region,
        },
    }

    if end_dt:
        payload["endDateTime"] = end_dt
    if precio_info:
        payload["priceInfo"] = precio_info

    venue: Dict[str, object] = {}
    if lugar:
        venue["name"] = lugar
    if ciudad_region:
        venue["address"] = ciudad_region
    if venue:
        payload["venue"] = venue

    tags = _detect_tags(titulo, descripcion, lugar, ciudad_region)
    if tags:
        payload["tags"] = tags

    cleaned_payload = {key: value for key, value in payload.items() if value not in (None, [], {}, "")}
    if not cleaned_payload.get("dateTime"):
        return None, "fecha invalida"
    return cleaned_payload, None


def _import_file(path: Path, *, dry_run: bool = False) -> ImportSummary:
    print(f"Procesando {path}...")
    records = _load_records(path)
    collection = db.collection("activities")
    summary = ImportSummary()

    for row in records:
        payload, error = _build_payload(row)
        if not payload:
            summary.skipped += 1
            if error:
                print(f"  - Omitido ({error}): {row.get('titulo') or row.get('title')}")
            continue

        doc_id = _doc_id(
            str(row.get("titulo") or ""),
            str(row.get("fecha_inicio") or ""),
            str(row.get("link") or ""),
        )

        if dry_run:
            summary.created += 1
            continue

        doc_ref = collection.document(doc_id)
        snapshot = doc_ref.get()

        timestamps = {"updatedAt": firestore.SERVER_TIMESTAMP}
        data = {**payload, **timestamps}

        if snapshot.exists:
            doc_ref.set(data, merge=True)
            summary.updated += 1
        else:
            data["createdAt"] = firestore.SERVER_TIMESTAMP
            doc_ref.set(data, merge=True)
            summary.created += 1

    print(f"  -> {summary.created} creados, {summary.updated} actualizados, {summary.skipped} omitidos")
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Importa Excel/CSV de ChileCultura a Firestore.")
    parser.add_argument(
        "--input",
        "-i",
        nargs="+",
        required=True,
        help="Rutas de archivos a importar (Excel .xlsx/.xls o CSV).",
    )
    parser.add_argument("--dry-run", action="store_true", help="No escribir en Firestore, solo contar registros.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    files: List[Path] = [Path(item).expanduser() for item in args.input]

    totals = ImportSummary()
    for file_path in files:
        if not file_path.exists():
            print(f"[!] Archivo no encontrado: {file_path}")
            continue

        summary = _import_file(file_path, dry_run=args.dry_run)
        totals.created += summary.created
        totals.updated += summary.updated
        totals.skipped += summary.skipped

    print("Resumen global:", totals.as_dict())


if __name__ == "__main__":
    main()
