from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import validates
from app.database import Base
import uuid

def gen_uuid():
    return uuid.uuid4().hex

class User(Base):
    __tablename__ = "users"

    id = Column(String(32), primary_key=True, default=gen_uuid, index=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(160), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @validates("email")
    def normalize_email(self, key, value):
        return (value or "").strip().lower()
