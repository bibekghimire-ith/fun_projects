"""Administrator identity model.

Per docs/DATABASE_DESIGN.md, `User` carries a `role` column directly rather
than a normalized `Role` table. docs/MASTER_PROMPT.md's data model list
mentions a separate `Role` table, but DATABASE_DESIGN.md (the authoritative
schema reference) only defines a `role` field on `User`; since this
application seeds exactly one administrator account for now, a string/enum
role column is the simplest production-quality option that still leaves
room to introduce a `Role` table later if multi-role RBAC is ever needed.
See docs/DECISIONS.md.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    """Supported roles. Only ADMIN is used until multi-role RBAC is needed."""

    ADMIN = "admin"


class User(Base, TimestampMixin):
    """An administrator account.

    There is no public registration route. Accounts are created only via
    the `flask bootstrap-admin` CLI command (see app/services/auth_service.py)
    or, in later phases, by an existing administrator through the admin UI.
    """

    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin')", name="ck_users_role_valid"),)

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=UserRole.ADMIN.value)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Flask-Login integration -------------------------------------------------
    # Flask-Login expects `is_authenticated`, `is_anonymous`, `get_id()`, and an
    # `is_active` attribute (already a real column above) on the user object.

    @property
    def is_authenticated(self) -> bool:  # pragma: no cover - trivial
        return True

    @property
    def is_anonymous(self) -> bool:  # pragma: no cover - trivial
        return False

    def get_id(self) -> str:
        return str(self.id)

    # --- Authorization helpers ---------------------------------------------------

    @property
    def is_admin(self) -> bool:
        return self.is_active and self.role == UserRole.ADMIN.value

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.email!r} role={self.role!r}>"
