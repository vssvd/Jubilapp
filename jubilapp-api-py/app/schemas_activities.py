from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Union

from pydantic import AliasChoices, BaseModel, Field, field_validator


class ActivityVenue(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=255)
    lat: Optional[float] = Field(default=None)
    lng: Optional[float] = Field(default=None)

    @field_validator("name", "address", mode="before")
    @classmethod
    def _trim_text(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return str(value)

    @field_validator("lat", "lng")
    @classmethod
    def _validate_coord(cls, value: object) -> Optional[float]:
        if value is None:
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            raise ValueError("Coordenada inválida")
        return parsed

    model_config = {
        "extra": "forbid",
        "populate_by_name": True,
    }


class ActivityAuditInfo(BaseModel):
    uid: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=255)
    name: Optional[str] = Field(default=None, max_length=255)

    @field_validator("uid", "email", "name", mode="before")
    @classmethod
    def _trim_actor_fields(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return str(value)

    model_config = {
        "extra": "forbid",
        "populate_by_name": True,
    }


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
    venue: Optional[ActivityVenue] = Field(default=None)

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
    venue: Optional[ActivityVenue] = Field(default=None)

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
    updated_at: Optional[datetime] = Field(default=None, serialization_alias="updatedAt")
    distance_km: Optional[float] = Field(default=None, serialization_alias="distanceKm")
    created_by: Optional[ActivityAuditInfo] = Field(default=None, serialization_alias="createdBy")
    updated_by: Optional[ActivityAuditInfo] = Field(default=None, serialization_alias="updatedBy")

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
    rating: Optional[int] = Field(
        default=None,
        ge=1,
        le=5,
        validation_alias=AliasChoices("rating", "feedbackRating", "feedback_rating"),
    )

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


class ActivityFeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(
        default=None,
        max_length=500,
        validation_alias=AliasChoices("comment", "feedbackComment", "feedback_comment", "notes"),
        serialization_alias="comment",
    )

    @field_validator("comment", mode="before")
    @classmethod
    def _trim_comment(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return str(value)

    model_config = {
        "extra": "forbid",
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


class ActivityReportBase(BaseModel):
    activity_id: Union[str, int] = Field(
        ...,
        validation_alias=AliasChoices("activityId", "activity_id"),
        serialization_alias="activityId",
    )
    activity_type: str = Field(
        ...,
        min_length=1,
        max_length=60,
        validation_alias=AliasChoices("activityType", "activity_type"),
        serialization_alias="activityType",
    )
    reason: Optional[str] = Field(default=None, max_length=500)
    title: Optional[str] = Field(default=None, max_length=255)
    emoji: Optional[str] = Field(default=None, max_length=16)
    category: Optional[str] = Field(default=None, max_length=120)

    @field_validator("activity_type", mode="before")
    @classmethod
    def _normalize_type(cls, value: object) -> object:
        if value is None:
            raise ValueError("El tipo de actividad es obligatorio")
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("El tipo de actividad es obligatorio")
            return cleaned
        return value

    @field_validator("activity_id", mode="before")
    @classmethod
    def _normalize_id(cls, value: object) -> object:
        if value is None:
            raise ValueError("El identificador es obligatorio")
        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("El identificador es obligatorio")
            return cleaned
        if isinstance(value, (int, float)):
            return value
        raise ValueError("El identificador debe ser texto o número")

    @field_validator("reason", mode="before")
    @classmethod
    def _trim_reason(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @field_validator("title", "emoji", "category", mode="before")
    @classmethod
    def _trim_optional_texts(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    model_config = {
        "extra": "forbid",
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


class ActivityReportCreate(ActivityReportBase):
    pass


class ActivityReportOut(ActivityReportBase):
    id: str
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, serialization_alias="updatedAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }
