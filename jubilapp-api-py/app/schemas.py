from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)  # Firebase exige >= 6
    full_name: str | None = None

class UserOut(BaseModel):
    uid: str
    email: EmailStr
    full_name: str | None = None

class AdminUserOut(BaseModel):
    uid: str
    email: EmailStr
    full_name: str | None = None
    created_at: datetime
    last_activity_at: datetime | None = None
    status: str

class AdminUserList(BaseModel):
    total: int
    items: list[AdminUserOut]


class AdminStatusOut(BaseModel):
    is_admin: bool
