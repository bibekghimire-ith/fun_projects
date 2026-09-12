"""PortfolioTemplate model.

Records which built-in visual templates ("themes") exist and which one is
currently active. The *set* of available templates is defined in code (see
`app/templates_engine/registry.py` - the authoritative source of truth for
what a template key means: its display name, description, and which Jinja
templates/CSS render it) so a template can never be "activated" without a
real implementation behind it. This table only tracks two things a
registry-only design can't: (1) a durable admin-configurable "which one is
active" flag that survives restarts, and (2) an id/timestamps for the admin
UI to reference. See docs/DECISIONS.md (Phase 3) for the full rationale,
including why "exactly one active" is enforced in the service layer
(`app/services/template_service.py`) rather than a DB constraint.
"""

from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PortfolioTemplate(Base, TimestampMixin):
    __tablename__ = "portfolio_templates"

    key: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<PortfolioTemplate {self.key!r} active={self.is_active}>"
