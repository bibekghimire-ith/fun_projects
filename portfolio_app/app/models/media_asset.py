"""Uploaded media tracking (Phase 7).

`MediaAsset` records every file an admin has uploaded through the local
storage adapter (app/common/storage.py) - not itself the storage mechanism,
just an audit trail + admin-facing list (so an admin can see what has been
uploaded and delete it) that stays valid regardless of which
`StorageAdapter` implementation is configured (`STORAGE_PROVIDER`). Deleting
the admin who uploaded a file never deletes the file/row (`ON DELETE
SET NULL`, matching `BlogPost.author_id`'s existing precedent -
docs/DECISIONS.md's Phase 5 section).
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import GUID, Base, TimestampMixin
from app.models.user import User  # noqa: F401 - ensures FK target is registered


class MediaAsset(Base, TimestampMixin):
    __tablename__ = "media_assets"

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="SET NULL")
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<MediaAsset {self.stored_name!r}>"
