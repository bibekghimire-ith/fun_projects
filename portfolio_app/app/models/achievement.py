"""Achievement model."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, OrderingMixin, VisibilityMixin


class Achievement(Base, OrderingMixin, VisibilityMixin):
    __tablename__ = "achievements"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    issuer: Mapped[str | None] = mapped_column(String(150))
    achievement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(500))

    profile = relationship("Profile", back_populates="achievements")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Achievement {self.title!r}>"
