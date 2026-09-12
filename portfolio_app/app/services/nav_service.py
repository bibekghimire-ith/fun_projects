"""Navigation configuration CRUD + defaults.

`ALLOWED_NAV_ENDPOINTS` is the code-level list of real public endpoints a
navigation entry may point at (mirrors the "registry defines what's
selectable" pattern `app/templates_engine/registry.py` established for
themes in Phase 3) - an admin can reorder/hide/relabel entries, or remove
them entirely, but can never point a nav entry at an arbitrary/unregistered
route.

`sync_defaults()` seeds the full default set whenever the table is empty -
a brand-new install, or an admin who has deleted every nav item and wants
the defaults back. Unlike `PortfolioTemplate`, a navigation list has no
other durable "already initialized" signal to key off (the row set itself
*is* the configuration), so "empty" is treated as "use the defaults"
rather than "the admin deliberately wants an empty nav" - the same
deterministic-default philosophy `template_service.sync_registry()` uses
for "no active template yet".
"""

from __future__ import annotations

import uuid
from typing import Any

from app.extensions import db
from app.models.navigation import NavigationItem
from app.services import portfolio_content as pc

ALLOWED_NAV_ENDPOINTS: list[tuple[str, str]] = [
    ("public.home", "Home"),
    ("public.about", "About"),
    ("public.experience", "Experience"),
    ("public.education", "Education"),
    ("public.skills", "Skills"),
    ("public.projects", "Projects"),
    ("public.certifications", "Certifications"),
    ("public.achievements", "Achievements"),
    ("public.resume", "Resume"),
    ("public.blog_home", "Blog"),
    ("public.contact", "Contact"),
]

_ALLOWED_ENDPOINT_KEYS = {key for key, _ in ALLOWED_NAV_ENDPOINTS}


def endpoint_choices() -> list[tuple[str, str]]:
    """`(endpoint, label)` pairs for the admin form's page-picker <select>."""

    return list(ALLOWED_NAV_ENDPOINTS)


def is_allowed_endpoint(endpoint: str) -> bool:
    return endpoint in _ALLOWED_ENDPOINT_KEYS


def sync_defaults() -> None:
    """Seed the default navigation on a brand-new install; idempotent."""

    if db.session.query(NavigationItem).first() is not None:
        return
    for index, (endpoint, label) in enumerate(ALLOWED_NAV_ENDPOINTS):
        db.session.add(
            NavigationItem(endpoint=endpoint, label=label, display_order=index, visible=True)
        )
    db.session.commit()


def list_all() -> list[NavigationItem]:
    """All navigation items (including hidden ones), for the admin list view."""

    sync_defaults()
    return pc.list_scoped(NavigationItem)


def list_visible_nav_items() -> list[NavigationItem]:
    """Visible navigation items, in display order, for the public header."""

    sync_defaults()
    return [item for item in pc.list_scoped(NavigationItem) if item.visible]


def get(entity_id: uuid.UUID) -> NavigationItem | None:
    return pc.get_scoped(NavigationItem, entity_id)


def create(fields: dict[str, Any]) -> NavigationItem:
    return pc.create_scoped(NavigationItem, fields)


def update(entity: NavigationItem, fields: dict[str, Any]) -> NavigationItem:
    return pc.update_entity(entity, fields)


def delete(entity: NavigationItem) -> None:
    pc.delete_entity(entity)


def move(entity: NavigationItem, direction: str) -> None:
    pc.move(NavigationItem, entity, direction)
