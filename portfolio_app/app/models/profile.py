"""Profile and SocialLink models.

Per docs/DATABASE_DESIGN.md, `Profile` is 1:1 with `User` (`user_id unique`)
- there is exactly one administrator in this application, so exactly one
`Profile` exists in practice, but the model still enforces the 1:1
relationship at the DB level rather than assuming it.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, OrderingMixin, TimestampMixin, VisibilityMixin


class Profile(Base, TimestampMixin):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    professional_title: Mapped[str | None] = mapped_column(String(150))
    tagline: Mapped[str | None] = mapped_column(String(255))
    biography: Mapped[str | None] = mapped_column(Text)
    profile_image_url: Mapped[str | None] = mapped_column(String(500))
    location_text: Mapped[str | None] = mapped_column(String(150))
    availability_text: Mapped[str | None] = mapped_column(String(150))
    public_email: Mapped[str | None] = mapped_column(String(255))

    user = relationship("User", backref="profile")
    social_links = relationship(
        "SocialLink",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="SocialLink.display_order",
    )
    experiences = relationship(
        "Experience",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="Experience.display_order",
    )
    educations = relationship(
        "Education",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="Education.display_order",
    )
    projects = relationship(
        "Project",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="Project.display_order",
    )
    certifications = relationship(
        "Certification",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="Certification.display_order",
    )
    achievements = relationship(
        "Achievement",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="Achievement.display_order",
    )
    resume = relationship(
        "Resume", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Profile {self.display_name!r}>"


class SocialLink(Base, OrderingMixin, VisibilityMixin):
    __tablename__ = "social_links"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str | None] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50))

    profile = relationship("Profile", back_populates="social_links")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SocialLink {self.platform!r}>"
