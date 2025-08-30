from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import RegisterIn, UserOut
from app.firebase import auth, db
from firebase_admin import auth as fb_auth
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from app.security import verify_firebase_token
from app.routers import interests, preparation
from app.routers import profile as profile_router
from app.database import Base, engine
# Importa modelos para registrar las tablas en el metadata
from app import models_interests  # noqa: F401

app = FastAPI(title="JubilApp API", version="0.1.0")

# CORS dev (ajusta en prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def init_tables():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # evitar que un fallo menor tumbe la app en dev
        pass

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(input: RegisterIn):
    email = input.email.lower().strip()
    try:
        user_record = fb_auth.create_user(
            email=email,
            password=input.password,
            display_name=input.full_name or None,
        )
    except fb_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="El email ya está registrado.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando usuario: {e}")

    try:
        db.collection("users").document(user_record.uid).set({
            "email": email,
            "full_name": (input.full_name or "").strip() or None,
            "created_at": SERVER_TIMESTAMP,
            "provider": "password",
        })
    except Exception as e:
        try:
            fb_auth.delete_user(user_record.uid)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Error guardando perfil: {e}")

    return UserOut(uid=user_record.uid, email=email, full_name=input.full_name)

@app.get("/api/me")
def me(user=Depends(verify_firebase_token)):
    try:
        db.collection("users").document(user["uid"]).set({"last_login": SERVER_TIMESTAMP}, merge=True)
    except Exception:
        pass
    return {
        "uid": user["uid"],
        "email": user.get("email"),
        "email_verified": user.get("email_verified"),
        "provider": user.get("firebase", {}).get("sign_in_provider"),
    }

@app.get("/api/users/{uid}/profile")
def get_profile(uid: str, user=Depends(verify_firebase_token)):
    if uid != user["uid"]:
        raise HTTPException(status_code=403, detail="Prohibido")
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return doc.to_dict()

# HU003/HU004 bajo /api
app.include_router(interests.router, prefix="/api")
app.include_router(preparation.router, prefix="/api")
app.include_router(profile_router.router, prefix="/api")
