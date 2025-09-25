import os
import os.path
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage
from dotenv import load_dotenv

# Cargar variables de .env
load_dotenv()

CRED_PATH = os.getenv("FIREBASE_CREDENTIALS")
if not CRED_PATH or not os.path.exists(CRED_PATH):
    raise RuntimeError("FIREBASE_CREDENTIALS no existe o la ruta es inválida")

# Nombre opcional del bucket de Storage (p.ej. "mi-proyecto.appspot.com")
STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET")

# Permite que otras librerías de Google usen las mismas credenciales.
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", CRED_PATH)

# Inicializa exactamente una vez
if not firebase_admin._apps:
    _cred = credentials.Certificate(CRED_PATH)
    options = {"storageBucket": STORAGE_BUCKET} if STORAGE_BUCKET else None
    _app = firebase_admin.initialize_app(_cred, options or None)
else:
    _app = firebase_admin.get_app()

# Cliente de Firestore ligado a esta app
db = firestore.client(_app)

# Bucket de Storage asociado (para subir audios u otros assets)
try:
    bucket = storage.bucket(STORAGE_BUCKET, app=_app) if STORAGE_BUCKET else None
except ValueError as exc:
    raise RuntimeError(
        "FIREBASE_STORAGE_BUCKET no está definido. Configura la variable de entorno con el nombre del bucket "
        "(por ejemplo 'mi-proyecto.appspot.com')."
    ) from exc

# ---- HU004: helper para verificar Firebase ID Token ----
def verify_id_token(authorization_header: str) -> str:
    """
    Recibe el header 'Authorization: Bearer <ID_TOKEN>'.
    Devuelve el uid si el token es válido; lanza ValueError si no lo es.
    """
    if not authorization_header or not authorization_header.lower().startswith("bearer "):
        raise ValueError("Missing Bearer token")
    token = authorization_header.split(" ", 1)[1]
    decoded = auth.verify_id_token(token, app=_app)  # usa la app ya inicializada
    return decoded["uid"]
