"""Shared model base classes and mixins.

These provide the conventions later phases build on: UUID primary keys for
externally exposed identifiers and UTC-aware created/updated timestamps.
No domain tables are defined in Phase 0 — this module exists so future
migrations start from a consistent base.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import CHAR, TypeDecorator

from app.extensions import db


def utcnow() -> datetime:
    return datetime.now(UTC)


class GUID(TypeDecorator):
    """Platform-independent UUID stored as a 36-char string.

    Avoids depending on PostgreSQL-only UUID column types so the same model
    definitions work against SQLite in tests and PostgreSQL in production.
    """

    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return uuid.UUID(value)


class TimestampMixin:
    """Adds UTC-aware created_at/updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class Base(db.Model):  # type: ignore[name-defined]
    """Abstract base providing a UUID primary key for all domain models."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)


class OrderingMixin:
    """Adds an explicit `display_order` column.

    Per CLAUDE.md: "Content should support ordering ... where appropriate."
    Sibling rows within the same parent are ordered by this integer,
    ascending; the admin service layer (app/services/*) is responsible for
    keeping values dense/consistent on create/delete/reorder, but nothing
    depends on that - only relative order matters, so a temporary gap or
    duplicate never corrupts display.
    """

    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class VisibilityMixin:
    """Adds an explicit `visible` column controlling public-site display.

    Per CLAUDE.md: "Content should support ... active/inactive visibility
    where appropriate." Defaults to True so newly created content is visible
    without an extra admin action, matching how the admin CRUD forms below
    default the "Visible" checkbox to checked.
    """

    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
