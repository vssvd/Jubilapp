from typing import Optional
from pydantic import BaseModel, EmailStr, AnyUrl


class ProfileOut(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[AnyUrl | str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class ProfileUpdate(BaseModel):
    # Todos opcionales para permitir updates parciales
    full_name: Optional[str] = None
    description: Optional[str] = None
    photo_url: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
