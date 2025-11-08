from datetime import date, datetime, time, timezone, timedelta
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from firebase_admin import auth

from app.schemas import AdminStatusOut, AdminStatsOut, AdminUserList, AdminUserOut
from app.security import is_admin_user, require_admin, verify_firebase_token
from app.services.admin_stats import (
    EXPORT_FORMATS,
    compute_admin_stats,
    stats_to_csv,
    stats_to_pdf,
)

router = APIRouter(prefix="/admin", tags=["admin"])

INACTIVE_AFTER_DAYS = 30

def _as_datetime(timestamp_ms: Optional[int]) -> Optional[datetime]:
    if not timestamp_ms:
        return None
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)


def _last_activity(record) -> Optional[datetime]:
    last_sign_in = record.user_metadata.last_sign_in_timestamp
    if last_sign_in:
        return _as_datetime(last_sign_in)
    return _as_datetime(record.user_metadata.creation_timestamp)


def _resolve_status(user_record) -> tuple[str, Optional[datetime]]:
    last_activity = _last_activity(user_record)
    if user_record.disabled:
        return "inactive", last_activity

    now = datetime.now(timezone.utc)
    if last_activity and now - last_activity <= timedelta(days=INACTIVE_AFTER_DAYS):
        return "active", last_activity

    return "inactive", last_activity


@router.get("/status", response_model=AdminStatusOut)
def admin_status(decoded=Depends(verify_firebase_token)) -> AdminStatusOut:
    return AdminStatusOut(is_admin=is_admin_user(decoded))


@router.get("/users", response_model=AdminUserList)
def list_users(
    start_date: Optional[date] = Query(
        default=None,
        description="Incluye usuarios creados desde esta fecha (YYYY-MM-DD)",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="Incluye usuarios creados hasta esta fecha (YYYY-MM-DD)",
    ),
    _admin=Depends(require_admin),
) -> AdminUserList:
    start_dt = (
        datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        if start_date
        else None
    )
    end_dt = (
        datetime.combine(end_date, time.max, tzinfo=timezone.utc)
        if end_date
        else None
    )

    users: list[AdminUserOut] = []
    for record in auth.list_users().iterate_all():
        created_at = _as_datetime(record.user_metadata.creation_timestamp)
        if not created_at:
            continue

        if start_dt and created_at < start_dt:
            continue
        if end_dt and created_at > end_dt:
            continue

        if not record.email:
            # Saltar usuarios sin email para evitar exponer cuentas incompletas.
            continue

        status, last_activity = _resolve_status(record)

        users.append(
            AdminUserOut(
                uid=record.uid,
                email=record.email,
                full_name=record.display_name or None,
                created_at=created_at,
                last_activity_at=last_activity,
                status=status,
            )
        )

    users.sort(key=lambda user: user.created_at, reverse=True)
    return AdminUserList(total=len(users), items=users)


def _resolve_date_range(
    start_date: Optional[date],
    end_date: Optional[date],
) -> tuple[date, date]:
    today = date.today()
    resolved_end = end_date or today
    resolved_start = start_date or (resolved_end - timedelta(days=29))

    if resolved_start > resolved_end:
        raise HTTPException(status_code=400, detail="La fecha inicial debe ser anterior o igual a la final.")

    return resolved_start, resolved_end


@router.get("/statistics", response_model=AdminStatsOut)
def statistics(
    start_date: Optional[date] = Query(
        default=None,
        description="YYYY-MM-DD. Por defecto últimos 30 días.",
        alias="start_date",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="YYYY-MM-DD. Por defecto hoy.",
        alias="end_date",
    ),
    top_limit: int = Query(5, ge=1, le=20, description="Cantidad máxima de actividades destacadas."),
    _admin=Depends(require_admin),
) -> AdminStatsOut:
    resolved_start, resolved_end = _resolve_date_range(start_date, end_date)
    try:
        return compute_admin_stats(resolved_start, resolved_end, top_limit=top_limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/statistics/export")
def export_statistics(
    format: str = Query(
        "csv",
        description="Formato deseado: csv o pdf.",
        pattern="^(csv|pdf)$",
    ),
    start_date: Optional[date] = Query(None, alias="start_date"),
    end_date: Optional[date] = Query(None, alias="end_date"),
    top_limit: int = Query(10, ge=1, le=20),
    _admin=Depends(require_admin),
):
    resolved_start, resolved_end = _resolve_date_range(start_date, end_date)
    try:
        stats = compute_admin_stats(resolved_start, resolved_end, top_limit=top_limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    filename = f"jubilapp_stats_{resolved_start.isoformat()}_{resolved_end.isoformat()}.{format}"

    if format == "csv":
        payload = stats_to_csv(stats).encode("utf-8")
        return StreamingResponse(
            io.BytesIO(payload),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Available-Formats": ",".join(EXPORT_FORMATS),
            },
        )

    pdf_bytes = stats_to_pdf(stats)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Available-Formats": ",".join(EXPORT_FORMATS),
        },
    )
