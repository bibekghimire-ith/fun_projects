"""BlogCategory CRUD + slug generation.

A small global list (like `SkillCategory` - docs/DECISIONS.md #18) with no
ordering/visibility semantics (docs/DATABASE_DESIGN.md's `BlogCategory` has
neither `display_order` nor `visible`), so this does not go through
app/services/portfolio_content.py's generic engine (which assumes both).
Slugging follows the exact same pattern as `app/services/project_service.py`
(slugify + suffix-until-unique) for consistency across the codebase.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from app.extensions import db
from app.models.blog import BlogCategory

_SLUG_INVALID = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = _SLUG_INVALID.sub("-", value).strip("-")
    return value or "category"


def unique_slug(base: str, exclude_id: uuid.UUID | None = None) -> str:
    candidate = base
    suffix = 2
    while True:
        query = db.session.query(BlogCategory).filter_by(slug=candidate)
        if exclude_id is not None:
            query = query.filter(BlogCategory.id != exclude_id)
        if query.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def list_categories() -> list[BlogCategory]:
    return db.session.query(BlogCategory).order_by(BlogCategory.name).all()


def get_category(entity_id: uuid.UUID) -> BlogCategory | None:
    return db.session.query(BlogCategory).filter_by(id=entity_id).first()


def get_category_by_slug(slug: str) -> BlogCategory | None:
    return db.session.query(BlogCategory).filter_by(slug=slug).first()


def create_category(fields: dict[str, Any]) -> BlogCategory:
    fields = dict(fields)
    fields["slug"] = unique_slug(slugify(fields.get("slug") or fields["name"]))
    category = BlogCategory(**fields)
    db.session.add(category)
    db.session.commit()
    return category


def update_category(entity: BlogCategory, fields: dict[str, Any]) -> BlogCategory:
    fields = dict(fields)
    fields["slug"] = unique_slug(
        slugify(fields.get("slug") or fields["name"]), exclude_id=entity.id
    )
    for key, value in fields.items():
        setattr(entity, key, value)
    db.session.commit()
    return entity


def delete_category(entity: BlogCategory) -> None:
    db.session.delete(entity)
    db.session.commit()
