"""In-code registry of built-in portfolio templates ("themes").

This is the single source of truth for *what templates exist* and what each
one is - Jinja template directory, stylesheet, human-readable name and
description. `app/services/template_service.py` mirrors this list into the
`portfolio_templates` DB table (so the admin can see/select them and the
"active" choice survives restarts) but never invents a template the
registry doesn't know about, and this module never touches the database -
keeping "which templates exist" (code, deployed with the app) cleanly
separate from "which one is active" (admin-configurable data).

Adding a sixth built-in template is a code change (a new `ThemeDefinition`
entry here + its `app/templates/themes/<key>/` + `app/static/css/themes/
<key>.css`), not a data-only change - intentional, since a theme is
presentation code, not admin-authored content.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ThemeDefinition:
    """Everything the rendering/admin layer needs to know about one theme."""

    key: str
    name: str
    description: str
    template_dir: str  # under app/templates/themes/<template_dir>/
    stylesheet: str  # static file under app/static/css/themes/<stylesheet>


_THEMES: dict[str, ThemeDefinition] = {
    "minimal": ThemeDefinition(
        key="minimal",
        name="Minimal Developer",
        description=(
            "Monospace, terminal-inspired layout with a dark-by-default "
            "palette. Favors whitespace and plain text over decoration."
        ),
        template_dir="minimal",
        stylesheet="minimal.css",
    ),
    "modern": ThemeDefinition(
        key="modern",
        name="Modern Professional",
        description=(
            "Clean corporate layout with a light neutral palette, generous "
            "spacing, and a conventional sans-serif type system."
        ),
        template_dir="modern",
        stylesheet="modern.css",
    ),
    "cybersecurity": ThemeDefinition(
        key="cybersecurity",
        name="Cybersecurity / Engineering",
        description=(
            "Dark, technical palette with a monospaced accent for "
            "credentials/skills and high-contrast status accents."
        ),
        template_dir="cybersecurity",
        stylesheet="cybersecurity.css",
    ),
    "academic": ThemeDefinition(
        key="academic",
        name="Academic / Research",
        description=(
            "Serif typography and a citation/publication-list visual "
            "language, muted palette, dense information layout."
        ),
        template_dir="academic",
        stylesheet="academic.css",
    ),
    "creative": ThemeDefinition(
        key="creative",
        name="Creative",
        description=(
            "Bold, expressive layout with an accent gradient, larger "
            "display type, and asymmetric section framing."
        ),
        template_dir="creative",
        stylesheet="creative.css",
    ),
}

#: Deterministic default so "no template is active yet" always resolves the
#: same way (first sync, or a future admin deleting a template's row).
DEFAULT_THEME_KEY = "minimal"


def all_themes() -> list[ThemeDefinition]:
    """All registered themes, in a stable (insertion) order."""

    return list(_THEMES.values())


def get_theme(key: str) -> ThemeDefinition | None:
    return _THEMES.get(key)


def is_valid_theme(key: str) -> bool:
    return key in _THEMES


def theme_keys() -> list[str]:
    return list(_THEMES.keys())
