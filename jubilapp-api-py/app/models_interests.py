from sqlalchemy import Column, String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

# Reutiliza tu User existente (no lo repito aquí)
# from app.models import User 

class Interest(Base):
    __tablename__ = "interests"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), unique=True, nullable=False, index=True)
    category = Column(String(120), nullable=True)

class UserInterest(Base):
    __tablename__ = "user_interests"
    user_id = Column(String(32), ForeignKey("users.id"), primary_key=True)
    interest_id = Column(Integer, ForeignKey("interests.id"), primary_key=True)

    __table_args__ = (UniqueConstraint("user_id", "interest_id", name="uix_user_interest"),)

    # opcional: relaciones (no estrictamente necesarias)
    user = relationship("User", backref="interests")       
    interest = relationship("Interest")
