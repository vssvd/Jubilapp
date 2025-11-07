from datetime import date, datetime, time, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from firebase_admin import auth

from app.schemas import AdminStatusOut, AdminUserList, AdminUserOut
from app.security import is_admin_user, require_admin, verify_firebase_token

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
