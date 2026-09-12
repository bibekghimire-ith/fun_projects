"""Public navigation configuration.

Per docs/MASTER_PROMPT.md ("exact public navigation should be configurable")
and CLAUDE.md's portfolio content model ("navigation"), the set and order of
links shown in the public site's header nav is admin-configurable data, not
hard-coded in a template. Since this application seeds exactly one
administrator/portfolio (see docs/DECISIONS.md), navigation is modeled as a
small global, unscoped, ordered/visible list - the same shape as
`SkillCategory`.

`endpoint` stores a Flask endpoint name (e.g. "public.projects") rather than
a raw URL, so a navigation entry can never point at an arbitrary/external
address through this model and is always resolved through `url_for` (a
reversed, guaranteed-valid route) at render time. Only endpoints in
`app/services/nav_service.ALLOWED_NAV_ENDPOINTS` (the code-level list of
real public routes) can be selected, enforced in the admin form/service -
the same "code defines what's selectable, data defines the active/ordered
subset" pattern `PortfolioTemplate` established in Phase 3.
"""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OrderingMixin, TimestampMixin, VisibilityMixin


class NavigationItem(Base, TimestampMixin, OrderingMixin, VisibilityMixin):
    __tablename__ = "navigation_items"

    label: Mapped[str] = mapped_column(String(100), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(100), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<NavigationItem {self.label!r}>"
