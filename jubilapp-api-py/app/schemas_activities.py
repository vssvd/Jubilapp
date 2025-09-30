from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import AliasChoices, BaseModel, Field, field_validator


class ActivityBase(BaseModel):
    type: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, max_length=120)
    date_time: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("dateTime", "date_time"),
        serialization_alias="dateTime",
    )
    location: Optional[str] = Field(default=None, max_length=255)
    link: str = Field(..., min_length=1, max_length=500)
    origin: str = Field(..., min_length=1, max_length=120)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator("type", "title", "link", "origin", mode="before")
    @classmethod
    def _required_not_empty(cls, value: object) -> object:
        if value is None:
            raise ValueError("El campo es obligatorio")
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("El campo no puede estar vacío")
            return cleaned
        return value

    @field_validator("category", "location", mode="before")
    @classmethod
    def _optional_trim(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @field_validator("tags", mode="before")
    @classmethod
    def _normalize_tags(cls, value: object) -> Optional[List[str]]:
        if value is None:
            return None

        items: List[str]

        if isinstance(value, str):
            items = [value]
        elif isinstance(value, (list, tuple, set)):
            items = []
            for item in value:
                if isinstance(item, str):
                    items.append(item)
                else:
                    raise ValueError("Cada tag debe ser texto")
        else:
            raise ValueError("Las tags deben ser una lista de textos")

        cleaned: List[str] = []
        for item in items:
            name = item.strip()
            if not name:
                continue
            if name not in cleaned:
                cleaned.append(name)

        return cleaned or None

    model_config = {
        "extra": "forbid",
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    type: Optional[str] = Field(default=None, min_length=1, max_length=50)
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = Field(default=None, max_length=120)
    date_time: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("dateTime", "date_time"),
        serialization_alias="dateTime",
    )
    location: Optional[str] = Field(default=None, max_length=255)
    link: Optional[str] = Field(default=None, min_length=1, max_length=500)
    origin: Optional[str] = Field(default=None, min_length=1, max_length=120)
    tags: Optional[List[str]] = Field(default=None)

    @field_validator("type", "title", "link", "origin", mode="before")
    @classmethod
    def _trim_required_fields(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @field_validator("category", "location", mode="before")
    @classmethod
    def _trim_optional_fields(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @field_validator("tags", mode="before")
    @classmethod
    def _normalize_tags(cls, value: object) -> Optional[List[str]]:
        if value is None:
            return None

        if isinstance(value, str):
            candidates = [value]
        elif isinstance(value, (list, tuple, set)):
            candidates = []
            for item in value:
                if isinstance(item, str):
                    candidates.append(item)
                else:
                    raise ValueError("Cada tag debe ser texto")
        else:
            raise ValueError("Las tags deben ser una lista de textos")

        cleaned: List[str] = []
        for item in candidates:
            name = item.strip()
            if not name:
                continue
            if name not in cleaned:
                cleaned.append(name)

        return cleaned or None

    model_config = {
        "extra": "forbid",
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


class ActivityOut(ActivityBase):
    id: str
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class ActivitiesSeedSummary(BaseModel):
    created: int
    updated: int
    skipped: int
    total: int


class ActivitiesSyncSummary(BaseModel):
    created: int
    updated: int
    skipped: int
    deleted: int
    errors: int
    total: int
