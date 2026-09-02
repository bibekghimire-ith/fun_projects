"""BlogTag CRUD + slug generation, and comma-separated-list assignment.

Tags are authored on the post form as a single comma-separated text field
(`"flask, security, xss"`), mirroring `ProjectTechnology`'s
`sync_technologies` pattern (docs/DECISIONS.md #20) - `assign_tags` resolves
each name to an existing `BlogTag` or creates one, and replaces a post's
`tags` list wholesale. Unlike `ProjectTechnology`, `BlogTag` rows are shared
across posts (a real many-to-many), so "replace wholesale" only ever changes
the association, never deletes a tag another post still uses.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from app.extensions import db
from app.models.blog import BlogPost, BlogTag

_SLUG_INVALID = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = _SLUG_INVALID.sub("-", value).strip("-")
    return value or "tag"


def unique_slug(base: str, exclude_id: uuid.UUID | None = None) -> str:
    candidate = base
    suffix = 2
    while True:
        query = db.session.query(BlogTag).filter_by(slug=candidate)
        if exclude_id is not None:
            query = query.filter(BlogTag.id != exclude_id)
        if query.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def list_tags() -> list[BlogTag]:
    return db.session.query(BlogTag).order_by(BlogTag.name).all()


def get_tag(entity_id: uuid.UUID) -> BlogTag | None:
    return db.session.query(BlogTag).filter_by(id=entity_id).first()


def get_tag_by_slug(slug: str) -> BlogTag | None:
    return db.session.query(BlogTag).filter_by(slug=slug).first()


def get_or_create_tag(name: str) -> BlogTag:
    existing = db.session.query(BlogTag).filter_by(name=name).first()
    if existing is not None:
        return existing
    tag = BlogTag(name=name, slug=unique_slug(slugify(name)))
    db.session.add(tag)
    db.session.flush()
    return tag


def create_tag(fields: dict[str, Any]) -> BlogTag:
    fields = dict(fields)
    fields["slug"] = unique_slug(slugify(fields.get("slug") or fields["name"]))
    tag = BlogTag(**fields)
    db.session.add(tag)
    db.session.commit()
    return tag


def update_tag(entity: BlogTag, fields: dict[str, Any]) -> BlogTag:
    fields = dict(fields)
    fields["slug"] = unique_slug(
        slugify(fields.get("slug") or fields["name"]), exclude_id=entity.id
    )
    for key, value in fields.items():
        setattr(entity, key, value)
    db.session.commit()
    return entity


def delete_tag(entity: BlogTag) -> None:
    db.session.delete(entity)
    db.session.commit()


def parse_tag_names(text: str) -> list[str]:
    return [part.strip() for part in text.split(",") if part.strip()]


def tags_to_text(post: BlogPost) -> str:
    return ", ".join(tag.name for tag in post.tags)


def assign_tags(post: BlogPost, names: list[str]) -> None:
    """Replace `post.tags` wholesale with tags resolved/created from `names`."""

    seen: set[str] = set()
    tags = []
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        tags.append(get_or_create_tag(name))
    post.tags = tags
    db.session.commit()
