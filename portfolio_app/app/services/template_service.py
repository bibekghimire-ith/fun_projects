"""Active-template management and theme-aware rendering.

Keeps "which templates exist" (`app/templates_engine/registry.py`, code)
separate from "which one is active" (`portfolio_templates` DB table, admin
data) and from "the portfolio content being rendered" (Profile/Experience/
etc., Phase 2 models - completely untouched by anything in this module).
Switching the active template is exactly one thing: flipping which row's
`is_active` is True. It never reads, writes, or otherwise touches any
portfolio-content table - that's what CLAUDE.md rule #16 ("Portfolio
content must be independent from visual templates") and this phase's exit
criterion ("switching templates changes presentation without changing
content") require, and it's exercised directly by
tests/test_template_engine.py.
"""

from __future__ import annotations

from typing import Any

from flask import render_template

from app.extensions import db
from app.models.portfolio_template import PortfolioTemplate
from app.templates_engine import registry


class UnknownTemplateError(ValueError):
    """Raised when a template key doesn't match any registered theme."""


def sync_registry() -> None:
    """Idempotently mirror `registry.all_themes()` into the DB.

    Creates a `PortfolioTemplate` row for any registered theme that doesn't
    have one yet (name/description kept in sync with the registry on every
    call, since those are presentation metadata, not admin-owned data), and
    activates a deterministic default (`registry.DEFAULT_THEME_KEY`) the
    first time this runs so `get_active_template()` never has to handle
    "no template is active yet" as a special case. Never deletes a row for
    a theme the registry no longer defines (so removing a theme from code
    doesn't crash an admin who has it active - it just becomes unselectable
    going forward; see docs/DECISIONS.md).
    """

    existing = {row.key: row for row in db.session.query(PortfolioTemplate).all()}

    for theme in registry.all_themes():
        row = existing.get(theme.key)
        if row is None:
            db.session.add(
                PortfolioTemplate(
                    key=theme.key,
                    name=theme.name,
                    description=theme.description,
                    is_active=False,
                )
            )
        else:
            row.name = theme.name
            row.description = theme.description

    db.session.commit()

    has_active = db.session.query(PortfolioTemplate).filter_by(is_active=True).first()
    if has_active is None:
        default_row = (
            db.session.query(PortfolioTemplate).filter_by(key=registry.DEFAULT_THEME_KEY).first()
        )
        if default_row is not None:
            default_row.is_active = True
            db.session.commit()


def list_templates() -> list[PortfolioTemplate]:
    """All known templates (registry-backed rows), ordered by name."""

    sync_registry()
    return db.session.query(PortfolioTemplate).order_by(PortfolioTemplate.name).all()


def get_active_template() -> PortfolioTemplate:
    """The currently active template row.

    Always resolves to exactly one row after `sync_registry()`'s
    deterministic-default behavior, so this never returns None.
    """

    sync_registry()
    active = db.session.query(PortfolioTemplate).filter_by(is_active=True).first()
    if active is None:  # pragma: no cover - guaranteed by sync_registry()
        raise RuntimeError("No active template after sync_registry(); this is a bug.")
    return active


def set_active_template(key: str) -> PortfolioTemplate:
    """Activate the template identified by `key`; deactivate every other row.

    Only a key present in the code-level registry can ever be activated -
    "only implemented/valid themes selectable" (an unrecognized key raises
    `UnknownTemplateError` rather than silently creating a phantom active
    template). Both the deactivate-all and activate-target updates happen
    in one commit, so a reader never observes zero or two active rows.
    This function never touches Profile/Experience/Project/etc. - switching
    templates changes presentation only, never content.
    """

    if not registry.is_valid_theme(key):
        raise UnknownTemplateError(f"{key!r} is not a registered template")

    sync_registry()

    rows = db.session.query(PortfolioTemplate).all()
    target = None
    for row in rows:
        if row.key == key:
            row.is_active = True
            target = row
        else:
            row.is_active = False
    db.session.commit()

    if target is None:  # pragma: no cover - sync_registry() guarantees the row exists
        raise RuntimeError(f"PortfolioTemplate row for {key!r} missing after sync; this is a bug.")
    return target


def render_preview(key: str, **context: Any) -> str:
    """Render the given theme's preview page with the supplied content context.

    Raises `UnknownTemplateError` for a key the registry doesn't recognize,
    the same guard `set_active_template` uses, so an invalid theme key can
    never reach `render_template` and probe the filesystem for an
    arbitrary template path.
    """

    theme = registry.get_theme(key)
    if theme is None:
        raise UnknownTemplateError(f"{key!r} is not a registered template")

    return render_template(
        f"themes/{theme.template_dir}/preview.html",
        theme=theme,
        preview_mode=True,
        **context,
    )
