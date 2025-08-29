import os
import os.path
import firebase_admin
from firebase_admin import credentials, auth, firestore
from dotenv import load_dotenv

# Cargar variables de .env
load_dotenv()

CRED_PATH = os.getenv("FIREBASE_CREDENTIALS")
if not CRED_PATH or not os.path.exists(CRED_PATH):
    raise RuntimeError("FIREBASE_CREDENTIALS no existe o la ruta es inválida")

# Inicializa exactamente una vez
if not firebase_admin._apps:
    _cred = credentials.Certificate(CRED_PATH)
    _app = firebase_admin.initialize_app(_cred)
else:
    _app = firebase_admin.get_app()

# Cliente de Firestore ligado a esta app
db = firestore.client(_app)

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
