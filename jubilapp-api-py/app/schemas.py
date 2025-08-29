# app/schemas.py
from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)  # Firebase exige >= 6
    full_name: str | None = None

class UserOut(BaseModel):
    uid: str
    email: EmailStr
    full_name: str | None = None
