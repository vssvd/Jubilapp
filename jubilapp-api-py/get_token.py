import os, requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("FIREBASE_WEB_API_KEY")

email = "prueba1@gmail.com"
password = "prueba123"  # la real

url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
payload = {"email": email, "password": password, "returnSecureToken": True}

r = requests.post(url, json=payload, timeout=10)
data = r.json()
print("Respuesta completa:", data)

if "idToken" in data:
    print("\nID TOKEN:\n", data["idToken"])
else:
    print("\nNo se encontró idToken. Revisa API_KEY, método Email/Password y la clave del usuario.")
