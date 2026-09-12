"""Education model."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, OrderingMixin, VisibilityMixin


class Education(Base, OrderingMixin, VisibilityMixin):
    __tablename__ = "educations"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    institution: Mapped[str] = mapped_column(String(150), nullable=False)
    degree: Mapped[str | None] = mapped_column(String(150))
    field: Mapped[str | None] = mapped_column(String(150))
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    grade_summary: Mapped[str | None] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)

    profile = relationship("Profile", back_populates="educations")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Education {self.institution!r}>"
