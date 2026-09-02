"""Certification model."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, OrderingMixin, VisibilityMixin


class Certification(Base, OrderingMixin, VisibilityMixin):
    __tablename__ = "certifications"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    issuer: Mapped[str] = mapped_column(String(150), nullable=False)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    credential_id: Mapped[str | None] = mapped_column(String(150))
    credential_url: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)

    profile = relationship("Profile", back_populates="certifications")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Certification {self.name!r}>"
