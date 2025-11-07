import os
import secrets
from functools import lru_cache

from passlib.context import CryptContext
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.firebase import auth, verify_id_token
from app.database import get_db
from app.models import User

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

_security = HTTPBearer(auto_error=False)

def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta encabezado Authorization: Bearer <ID_TOKEN>",
        )
    try:
        return auth.verify_id_token(credentials.credentials)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

# obtiene el usuario actual de la BD usando el email del token de Firebase.
# Si no existe, lo crea (auto-provisioning) para que HU001/HU002 funcionen con Firebase Auth.
def get_current_user(
    decoded: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db),
) -> User:
    email = (decoded.get("email") or "").strip().lower()
    if not email:
        # Si no viene email en el token (p.ej. provider phone-only), podrías usar 'uid'
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin email")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Auto-provisión (puedes desactivarlo si prefieres fallar)
        user = User(
            email=email,
            password_hash="firebase",  
            full_name=decoded.get("name"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
def get_current_uid(authorization: str = Header(None)) -> str:
    try:
        return verify_id_token(authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")


def get_current_uid_or_task(authorization: str = Header(None)) -> str:
    expected = (os.getenv("SYNC_TASK_TOKEN") or "").strip()
    if expected and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if token and secrets.compare_digest(token, expected):
            return "scheduler-task"
    return get_current_uid(authorization)


@lru_cache(maxsize=1)
def _admin_email_set() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS") or ""
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def is_admin_user(decoded: dict | None) -> bool:
    """
    Determina si el token decodificado pertenece a un administrador.
    Considera el claim 'admin' o la lista ADMIN_EMAILS en el backend.
    """
    if not decoded:
        return False

    if decoded.get("admin") is True:
        return True

    custom_claims = decoded.get("claims") or decoded.get("custom_claims") or {}
    if custom_claims.get("admin"):
        return True

    email = (decoded.get("email") or "").strip().lower()
    return bool(email and email in _admin_email_set())


def require_admin(decoded: dict = Depends(verify_firebase_token)) -> dict:
    """
    Verifica que el usuario autenticado tenga privilegios de administrador.
    Se acepta el claim 'admin' en el token o que su correo esté listado en ADMIN_EMAILS.
    """
    if is_admin_user(decoded):
        return decoded

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Solo administradores pueden acceder a este recurso.",
    )
