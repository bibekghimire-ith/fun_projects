"""Contact message model (Phase 7).

Per docs/DATABASE_DESIGN.md's `ContactMessage` table: `name`/`email`/
`subject`/`message`/`status`/`created_at`/`processed_at`. `status` follows
the same "plain column + CHECK constraint" convention `User.role`
(docs/DECISIONS.md #12) and `BlogPost.status` already established, rather
than a normalized lookup table - exactly three admin-triage states are
needed (`new`/`read`/`archived`) and nothing else references them.

`ip_address` is additional (not in the DATABASE_DESIGN.md list, but the
Phase 7 task explicitly asks for "IP or similar" to support admin triage/
spam review) - stored for the admin's own reference only, never rendered on
any public page, and not used to identify anyone beyond what CLAUDE.md's
"no PII exposure" rules already require of every admin-only view.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ContactMessageStatus:
    NEW = "new"
    READ = "read"
    ARCHIVED = "archived"

    ALL = (NEW, READ, ARCHIVED)


class ContactMessage(Base, TimestampMixin):
    __tablename__ = "contact_messages"
    __table_args__ = (
        CheckConstraint("status IN ('new', 'read', 'archived')", name="ck_contact_messages_status"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subject: Mapped[str | None] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ContactMessageStatus.NEW, index=True
    )
    ip_address: Mapped[str | None] = mapped_column(String(45))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ContactMessage {self.email!r} status={self.status!r}>"
