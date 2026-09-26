from datetime import datetime
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


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category_id: int | None = None
    condition_score: int = Field(default=5, ge=1, le=10)
    status: str = Field(default="available")
    image_url: str | None = None


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category_id: int | None = None
    condition_score: int | None = Field(default=None, ge=1, le=10)
    status: str | None = None
    image_url: str | None = None


class ItemRead(ItemBase):
    model_config = ConfigDict(from_attributes=True)

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
