from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

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


class ActivityHistoryBase(BaseModel):
    activity_id: Optional[str] = Field(
        default=None,
        max_length=120,
        validation_alias=AliasChoices("activityId", "activity_id"),
        serialization_alias="activityId",
    )
    title: str = Field(..., min_length=1, max_length=255)
    emoji: Optional[str] = Field(default=None, max_length=16)
    category: Optional[str] = Field(default=None, max_length=120)
    type: Optional[str] = Field(default=None, max_length=50)
    origin: Optional[str] = Field(default=None, max_length=120)
    date_time: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("dateTime", "date_time"),
        serialization_alias="dateTime",
    )
    completed_at: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("completedAt", "completed_at"),
        serialization_alias="completedAt",
    )
    tags: Optional[List[str]] = Field(default=None)
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("title", mode="before")
    @classmethod
    def _require_title(cls, value: object) -> object:
        if value is None:
            raise ValueError("El título es obligatorio")
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("El título es obligatorio")
            return cleaned
        return value

    @field_validator("activity_id", "emoji", "category", "type", "origin", "notes", mode="before")
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


class ActivityHistoryCreate(ActivityHistoryBase):
    pass


class ActivityHistoryOut(ActivityHistoryBase):
    id: str
    completed_at: datetime = Field(serialization_alias="completedAt")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, serialization_alias="updatedAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class ActivityFavoriteBase(BaseModel):
    activity_id: str = Field(
        ...,
        min_length=1,
        max_length=120,
        validation_alias=AliasChoices("activityId", "activity_id"),
        serialization_alias="activityId",
    )
    activity_type: str = Field(
        ...,
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("activityType", "activity_type"),
        serialization_alias="activityType",
    )
    title: str = Field(..., min_length=1, max_length=255)
    emoji: Optional[str] = Field(default=None, max_length=16)
    category: Optional[str] = Field(default=None, max_length=120)
    origin: Optional[str] = Field(default=None, max_length=120)
    link: Optional[str] = Field(default=None, max_length=500)
    date_time: Optional[datetime] = Field(
        default=None,
        validation_alias=AliasChoices("dateTime", "date_time"),
        serialization_alias="dateTime",
    )
    tags: Optional[List[str]] = Field(default=None)
    source: Optional[Dict[str, object]] = Field(default=None)

    @field_validator("activity_id", "activity_type", "title", mode="before")
    @classmethod
    def _require_primary_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("El campo es obligatorio")
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("El campo no puede estar vacío")
            return cleaned
        return value

    @field_validator("emoji", "category", "origin", "link", mode="before")
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

        candidates: List[str]
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


class ActivityFavoriteCreate(ActivityFavoriteBase):
    pass


class ActivityFavoriteOut(ActivityFavoriteBase):
    id: str
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, serialization_alias="updatedAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }
