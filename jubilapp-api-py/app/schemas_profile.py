from typing import Optional
from pydantic import BaseModel, EmailStr, AnyUrl


class ProfileOut(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[AnyUrl | str] = None


class ProfileUpdate(BaseModel):
    # Todos opcionales para permitir updates parciales
    full_name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
