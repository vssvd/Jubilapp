from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
import io
import logging
from typing import Dict, Iterable, List, Optional, Tuple

from firebase_admin import firestore
from google.api_core.exceptions import FailedPrecondition
try:
    from fpdf import FPDF  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    FPDF = None  # type: ignore[assignment]

from app.firebase import db
from app.schemas import (
    AdminStatsCategoryShare,
    AdminStatsDailyPoint,
    AdminStatsMonthlyPoint,
    AdminStatsOut,
    AdminStatsSummary,
    AdminStatsTopActivity,
)

MAX_RANGE_DAYS = 365
DEFAULT_TOP_LIMIT = 5
EXPORT_FORMATS = ["csv"] + (["pdf"] if FPDF else [])
_MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

logger = logging.getLogger(__name__)


def _to_datetime(value: object) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if hasattr(value, "to_datetime"):
        dt = value.to_datetime()  # type: ignore[attr-defined]
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None


def _owner_uid(snapshot) -> Optional[str]:
    ref = snapshot.reference
    parent = getattr(ref, "parent", None)
    if not parent:
        return None
    owner = getattr(parent, "parent", None)
    if not owner:
        return None
    return getattr(owner, "id", None)


def _normalize_category(value: Optional[str]) -> str:
    if value is None:
        return "Sin categoría"
    if not isinstance(value, str):
        value = str(value)
    cleaned = value.strip()
    return cleaned or "Sin categoría"


def _month_label(month_start: date) -> str:
    try:
        name = _MONTH_LABELS[month_start.month - 1]
    except IndexError:
        name = month_start.strftime("%b")
    return f"{name} {month_start.year}"


def _latin(text: str) -> str:
    return text.encode("latin-1", "replace").decode("latin-1")


def _activity_history_stream(start_dt: datetime, end_dt: datetime):
    """
    Yields (is_fallback, snapshot) tuples. If Firestore complains about missing
    collection-group indexes we fall back to streaming the full collection and
    filtering in memory so the endpoint still works (just a bit slower).
    """
    base_query = db.collection_group("activityHistory")
    filtered_query = base_query.where("completedAt", ">=", start_dt).where("completedAt", "<=", end_dt)
    try:
        for snapshot in filtered_query.stream():
            yield False, snapshot
        return
    except FailedPrecondition as exc:
        # Firestore sends a direct link to create the missing index. We log it and continue.
        logger.warning("Falta un índice para activityHistory.completedAt. Se usará filtrado local. Detalle: %s", exc)
    except Exception:
        # Propagate non-index errors.
        raise

    for snapshot in base_query.stream():
        yield True, snapshot


def compute_admin_stats(
    start: date,
    end: date,
    *,
    top_limit: int = DEFAULT_TOP_LIMIT,
) -> AdminStatsOut:
    if start > end:
        raise ValueError("La fecha inicial no puede ser posterior a la final.")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise ValueError(f"El rango máximo permitido es de {MAX_RANGE_DAYS} días.")

    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end, time.max, tzinfo=timezone.utc)

    daily_users: Dict[date, set[str]] = defaultdict(set)
    daily_activity_counts: Counter[date] = Counter()
    monthly_users: Dict[date, set[str]] = defaultdict(set)
    category_counts: Counter[str] = Counter()
    top_counts: Counter[str] = Counter()
    top_meta: Dict[str, Tuple[Optional[str], str, Optional[str]]] = {}

    total_activities = 0
    unique_users: set[str] = set()

    for fallback_mode, snapshot in _activity_history_stream(start_dt, end_dt):
        data = snapshot.to_dict() or {}
        completed_at = (
            _to_datetime(data.get("completedAt"))
            or _to_datetime(data.get("completed_at"))
            or _to_datetime(data.get("dateTime"))
            or _to_datetime(data.get("date_time"))
            or _to_datetime(data.get("createdAt"))
        )
        if not completed_at:
            continue
        if fallback_mode and (completed_at < start_dt or completed_at > end_dt):
            continue
        completed_date = completed_at.date()
        if completed_date < start or completed_date > end:
            continue

        uid = _owner_uid(snapshot)
        if not uid:
            continue

        total_activities += 1
        unique_users.add(uid)

        daily_users[completed_date].add(uid)
        daily_activity_counts[completed_date] += 1

        month_key = completed_date.replace(day=1)
        monthly_users[month_key].add(uid)

        category = _normalize_category(data.get("category"))
        category_counts[category] += 1

        title = str(data.get("title") or "").strip() or "Actividad sin título"
        category_for_activity = str(data.get("category") or "").strip() or None
        activity_id = data.get("activityId") or data.get("activity_id")
        key = str(activity_id) if activity_id else f"title::{title.lower()}"
        if key not in top_meta:
            top_meta[key] = (activity_id if activity_id else None, title, category_for_activity)
        top_counts[key] += 1

    total_days = (end - start).days + 1
    sum_daily_active = sum(len(users) for users in daily_users.values())

    daily_series: List[AdminStatsDailyPoint] = []
    current_day = start
    while current_day <= end:
        daily_series.append(
            AdminStatsDailyPoint(
                date=current_day,
                active_users=len(daily_users.get(current_day, set())),
                activities=daily_activity_counts.get(current_day, 0),
            )
        )
        current_day += timedelta(days=1)

    monthly_series: List[AdminStatsMonthlyPoint] = []
    for month_date in sorted(monthly_users.keys()):
        label = _month_label(month_date)
        monthly_series.append(
            AdminStatsMonthlyPoint(
                month=f"{month_date.year:04d}-{month_date.month:02d}",
                label=label,
                active_users=len(monthly_users[month_date]),
            )
        )

    mau_current = 0
    current_month_key = end.replace(day=1)
    if current_month_key in monthly_users:
        mau_current = len(monthly_users[current_month_key])

    top_limit = max(1, min(50, top_limit))
    top_activities: List[AdminStatsTopActivity] = []
    for key, count in top_counts.most_common(top_limit):
        meta = top_meta.get(key)
        if not meta:
            continue
        activity_id, title, category_for_activity = meta
        percentage = round(count * 100 / total_activities, 2) if total_activities else 0.0
        top_activities.append(
            AdminStatsTopActivity(
                id=activity_id,
                title=title,
                category=category_for_activity,
                count=count,
                percentage=percentage,
            )
        )

    category_breakdown: List[AdminStatsCategoryShare] = []
    for name, count in category_counts.most_common():
        percentage = round(count * 100 / total_activities, 2) if total_activities else 0.0
        category_breakdown.append(
            AdminStatsCategoryShare(category=name, count=count, percentage=percentage)
        )

    summary = AdminStatsSummary(
        range_start=start,
        range_end=end,
        total_days=total_days,
        total_activities=total_activities,
        unique_users=len(unique_users),
        days_with_activity=len(daily_users),
        average_activities_per_day=round(total_activities / total_days, 2) if total_days else 0.0,
        dau_average=round(sum_daily_active / total_days, 2) if total_days else 0.0,
        dau_current=len(daily_users.get(end, set())),
        mau_current=mau_current,
    )

    return AdminStatsOut(
        generated_at=datetime.now(timezone.utc),
        summary=summary,
        daily_active=daily_series,
        monthly_active=monthly_series,
        top_activities=top_activities,
        category_breakdown=category_breakdown,
        export_formats=EXPORT_FORMATS,
    )


def stats_to_csv(stats: AdminStatsOut) -> str:
    import csv

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    summary = stats.summary
    writer.writerow(["Resumen"])
    writer.writerow(["Generado", stats.generated_at.isoformat()])
    writer.writerow(["Rango", f"{summary.range_start.isoformat()} → {summary.range_end.isoformat()}"])
    writer.writerow(["Actividades totales", summary.total_activities])
    writer.writerow(["Usuarios únicos", summary.unique_users])
    writer.writerow(["Días con actividad", summary.days_with_activity])
    writer.writerow(["Prom. actividades/día", summary.average_activities_per_day])
    writer.writerow(["DAU promedio", summary.dau_average])
    writer.writerow(["DAU (último día)", summary.dau_current])
    writer.writerow(["MAU (mes actual)", summary.mau_current])

    writer.writerow([])
    writer.writerow(["Actividad diaria"])
    writer.writerow(["Fecha", "Usuarios activos", "Actividades"])
    for point in stats.daily_active:
        writer.writerow([point.date.isoformat(), point.active_users, point.activities])

    writer.writerow([])
    writer.writerow(["Top actividades"])
    writer.writerow(["Título", "Categoría", "Conteo", "% sobre total"])
    for activity in stats.top_activities:
        writer.writerow(
            [
                activity.title,
                activity.category or "Sin categoría",
                activity.count,
                f"{activity.percentage:.2f}",
            ]
        )

    writer.writerow([])
    writer.writerow(["Categorías"])
    writer.writerow(["Categoría", "Conteo", "% sobre total"])
    for item in stats.category_breakdown:
        writer.writerow([item.category, item.count, f"{item.percentage:.2f}"])

    return buffer.getvalue()


def stats_to_pdf(stats: AdminStatsOut) -> bytes:
    if FPDF is None:
        raise RuntimeError(
            "La exportación a PDF requiere la dependencia opcional 'fpdf2'. "
            "Instálala con `pip install fpdf2` para habilitar este formato."
        )

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, _latin("JubilApp – Estadísticas de uso"), ln=1)

    summary = stats.summary
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 8, _latin(f"Generado: {stats.generated_at.strftime('%Y-%m-%d %H:%M UTC')}"), ln=1)
    pdf.cell(0, 8, _latin(f"Rango: {summary.range_start.isoformat()} → {summary.range_end.isoformat()}"), ln=1)
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, _latin("Resumen"), ln=1)
    pdf.set_font("Helvetica", "", 11)
    summary_lines = [
        f"Actividades totales: {summary.total_activities}",
        f"Usuarios únicos: {summary.unique_users}",
        f"Días con actividad: {summary.days_with_activity}/{summary.total_days}",
        f"Prom. actividades/día: {summary.average_activities_per_day}",
        f"DAU promedio: {summary.dau_average}",
        f"DAU (último día): {summary.dau_current}",
        f"MAU (mes actual): {summary.mau_current}",
    ]
    for line in summary_lines:
        pdf.cell(0, 6, _latin(line), ln=1)

    if stats.top_activities:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, _latin("Top actividades"), ln=1)
        pdf.set_font("Helvetica", "", 11)
        for activity in stats.top_activities:
            text = f"{activity.title} ({activity.category or 'Sin categoría'}) – {activity.count} ({activity.percentage:.1f}%)"
            pdf.multi_cell(0, 6, _latin(text))

    if stats.category_breakdown:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, _latin("Categorías"), ln=1)
        pdf.set_font("Helvetica", "", 11)
        for item in stats.category_breakdown:
            text = f"{item.category}: {item.count} ({item.percentage:.1f}%)"
            pdf.cell(0, 6, _latin(text), ln=1)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, _latin("Actividad diaria"), ln=1)
    pdf.set_font("Helvetica", "", 10)
    for point in stats.daily_active:
        text = f"{point.date.isoformat()}: {point.active_users} usuarios activos / {point.activities} actividades"
        pdf.cell(0, 5, _latin(text), ln=1)

    output = pdf.output(dest="S").encode("latin-1", "replace")
    return output


__all__ = [
    "compute_admin_stats",
    "stats_to_csv",
    "stats_to_pdf",
    "EXPORT_FORMATS",
    "MAX_RANGE_DAYS",
]
