from sqlalchemy import (
    UUID,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    trust_score = Column(Integer, default=100)
    rejection_count = Column(Integer, default=0)
    cooldown_until = Column(DateTime, nullable=True)
    role = Column(String(20), default="parent")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    items = relationship("Item", back_populates="owner", cascade="all, delete-orphan")
    wishlists = relationship("Wishlist", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    c_id = Column(Integer, primary_key=True, index=True)
    c_name = Column(String(50), unique=True, nullable=False)
    icon = Column(String(50), nullable=True)


class Item(Base):
    __tablename__ = "items"

    item_id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.c_id", ondelete="SET NULL"), nullable=True)
    condition_score = Column(Integer, default=5)
    status = Column(String(20), default="available")
    image_url = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="items")
    wishlists = relationship("Wishlist", back_populates="item", cascade="all, delete-orphan")


class Wishlist(Base):
    __tablename__ = "wishlists"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_wishlist_user_item"),)

    wishlist_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="wishlists")
    item = relationship("Item", back_populates="wishlists")


class SwapProposal(Base):
    __tablename__ = "swap_proposals"
    __table_args__ = (UniqueConstraint("cycle_id", "giver_id", "item_id", name="uq_sp_cycle_giver_item"),)

    sp_id = Column(Integer, primary_key=True, index=True)
    cycle_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    giver_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending")
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    responded_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    expiry_warning_sent = Column(Boolean, default=False)

    giver = relationship("User", foreign_keys=[giver_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    item = relationship("Item")


class SwapHistory(Base):
    __tablename__ = "swap_history"

    sh_id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.item_id", ondelete="CASCADE"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    cycle_id = Column(UUID(as_uuid=True), nullable=True)
    swap_date = Column(DateTime, server_default=func.now())
    notes = Column(Text, nullable=True)


class UserPreference(Base):
    __tablename__ = "user_preferences"
    __table_args__ = (UniqueConstraint("user_id", "avoid_user_id", name="uq_user_preferences_user_avoid"),)

    uf_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    avoid_user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    reason = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    avoid_user = relationship("User", foreign_keys=[avoid_user_id])


class TrustLog(Base):
    __tablename__ = "trust_logs"

    tl_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    score_change = Column(Integer, nullable=False)
    logged_at = Column(DateTime, server_default=func.now())
    description = Column(Text, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    n_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    related_cycle_id = Column(UUID(as_uuid=True), nullable=True)
