from datetime import date, datetime
from typing import List

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


class AdminStatsSummary(BaseModel):
    range_start: date = Field(serialization_alias="rangeStart")
    range_end: date = Field(serialization_alias="rangeEnd")
    total_days: int = Field(serialization_alias="totalDays")
    total_activities: int = Field(serialization_alias="totalActivities")
    unique_users: int = Field(serialization_alias="uniqueUsers")
    days_with_activity: int = Field(serialization_alias="daysWithActivity")
    average_activities_per_day: float = Field(serialization_alias="averageActivitiesPerDay")
    dau_average: float = Field(serialization_alias="dauAverage")
    dau_current: int = Field(serialization_alias="dauCurrent")
    mau_current: int = Field(serialization_alias="mauCurrent")


class AdminStatsDailyPoint(BaseModel):
    date: date
    active_users: int = Field(serialization_alias="activeUsers")
    activities: int


class AdminStatsMonthlyPoint(BaseModel):
    month: str
    label: str
    active_users: int = Field(serialization_alias="activeUsers")


class AdminStatsTopActivity(BaseModel):
    id: str | None = None
    title: str
    category: str | None = None
    count: int
    percentage: float


class AdminStatsCategoryShare(BaseModel):
    category: str
    count: int
    percentage: float


class AdminStatsOut(BaseModel):
    generated_at: datetime = Field(serialization_alias="generatedAt")
    summary: AdminStatsSummary
    daily_active: List[AdminStatsDailyPoint] = Field(serialization_alias="dailyActive")
    monthly_active: List[AdminStatsMonthlyPoint] = Field(serialization_alias="monthlyActive")
    top_activities: List[AdminStatsTopActivity] = Field(serialization_alias="topActivities")
    category_breakdown: List[AdminStatsCategoryShare] = Field(serialization_alias="categoryBreakdown")
    export_formats: List[str] = Field(serialization_alias="exportFormats")
