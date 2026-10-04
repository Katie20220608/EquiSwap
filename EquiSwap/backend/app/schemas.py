from datetime import date as DateType
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: str | None = None


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class PasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    trust_score: int
    rejection_count: int
    role: str
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


AgeGroup = Literal["0-2", "3-5", "6-8", "9-12", "13+"]


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category_id: int | None = None
    condition_score: int = Field(default=5, ge=1, le=10)
    age_group: AgeGroup | None = None
    image_url: str | None = None


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: int | None = None
    condition_score: int | None = Field(default=None, ge=1, le=10)
    age_group: AgeGroup | None = None
    image_url: str | None = None


class ItemRead(ItemBase):
    model_config = ConfigDict(from_attributes=True)

    status: str

    item_id: int
    owner_id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AdminUserRead(UserRead):
    items: list[ItemRead] = Field(default_factory=list)


class UserDirectoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    name: str


class WishlistCreate(BaseModel):
    item_id: int


class WishlistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    wishlist_id: int
    user_id: int
    item_id: int
    created_at: datetime | None = None


class PreferenceCreate(BaseModel):
    avoid_user_id: int
    reason: str | None = Field(default=None, max_length=100)


class PreferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uf_id: int
    user_id: int
    avoid_user_id: int
    avoid_user_name: str | None = None
    reason: str | None = None
    created_at: datetime | None = None


class SwapProposeRequest(BaseModel):
    user_ids: list[int]


class SwapProposalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sp_id: int
    cycle_id: UUID
    giver_id: int
    receiver_id: int
    item_id: int
    status: str
    expires_at: datetime | None = None
    created_at: datetime | None = None
    responded_at: datetime | None = None
    rejection_reason: str | None = None


class SwapRespondRequest(BaseModel):
    decision: str = Field(pattern=r"^(accepted|rejected)$")
    rejection_reason: str | None = None


class SwapMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class SwapMessageRead(BaseModel):
    message_id: int
    cycle_id: UUID
    sender_id: int
    sender_name: str
    message: str
    created_at: datetime | None = None


class SwapHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sh_id: int
    item_id: int
    from_user_id: int
    to_user_id: int
    cycle_id: UUID | None = None
    swap_date: datetime | None = None
    notes: str | None = None


class TrustLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tl_id: int
    user_id: int
    action: str
    score_change: int
    logged_at: datetime | None = None
    description: str | None = None


class TrustScoreRead(BaseModel):
    user_id: int
    trust_score: int
    rejection_count: int
    history: list[TrustLogRead]


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    n_id: int
    user_id: int
    type: str
    message: str
    is_read: bool
    created_at: datetime | None = None
    related_cycle_id: UUID | None = None


class DailyCount(BaseModel):
    day: DateType
    count: int


class CategoryStat(BaseModel):
    category: str
    items: int
    wishlists: int


class AdminStatsRead(BaseModel):
    total_users: int
    new_users_7d: int
    total_items: int
    available_items: int
    open_swaps: int
    completed_swaps: int
    proposal_status_counts: dict[str, int]
    signups_per_day: list[DailyCount]
    swaps_per_day: list[DailyCount]
    top_categories: list[CategoryStat]


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminSwapCounts(BaseModel):
    given: int
    received: int
    completed: int
    rejected: int


class AdminUserDetail(BaseModel):
    user: UserRead
    items: list[ItemRead]
    swap_counts: AdminSwapCounts
    wishlist_count: int
    recent_trust_logs: list[TrustLogRead]


class CycleLengthStat(BaseModel):
    length: int
    total: int
    completed: int
    success_rate: float


class RejectionReasonStat(BaseModel):
    reason: str
    count: int


class AdminSwapInsights(BaseModel):
    total_cycles: int
    completed_cycles: int
    success_rate: float
    average_cycle_length: float
    average_hours_to_complete: float | None
    outcome_counts: dict[str, int]
    by_length: list[CycleLengthStat]
    top_rejection_reasons: list[RejectionReasonStat]
    stale_pending_cycles: int
