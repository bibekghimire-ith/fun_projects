"""Resume model.

Per docs/DATABASE_DESIGN.md, `Resume` has only `updated_at` (no
`created_at`), and is 1:1 with `Profile`. `storage_reference` is an
adapter-agnostic pointer (e.g. a local file path/key) distinct from
`public_url`, mirroring CLAUDE.md's "design a storage adapter" media
guidance even though only URL-based resumes (not file upload) are in scope
for this phase.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, utcnow


class Resume(Base):
    __tablename__ = "resumes"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(String(150))
    storage_reference: Mapped[str | None] = mapped_column(String(500))
    public_url: Mapped[str | None] = mapped_column(String(500))
    download_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    profile = relationship("Profile", back_populates="resume")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Resume profile_id={self.profile_id!s}>"
