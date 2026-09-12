"""Project CRUD + reordering (scoped to a Profile), plus technology sync.

`ProjectTechnology` rows are managed as a single ordered list of names on
the project form (see docs/DECISIONS.md) rather than through their own
admin CRUD screens - `sync_technologies` replaces a project's technology
list wholesale from a plain ordered list of strings, which is simpler for
an admin to author ("React, Flask, PostgreSQL") than a nested subform while
still producing normalized, individually-ordered `ProjectTechnology` rows
per docs/DATABASE_DESIGN.md.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from app.extensions import db
from app.models.profile import Profile
from app.models.project import Project, ProjectTechnology
from app.services import portfolio_content as pc

_SLUG_INVALID = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = _SLUG_INVALID.sub("-", value).strip("-")
    return value or "project"


def unique_slug(base: str, exclude_id: uuid.UUID | None = None) -> str:
    """Append -2, -3, ... until the slug isn't already taken by another project."""

    candidate = base
    suffix = 2
    while True:
        query = db.session.query(Project).filter_by(slug=candidate)
        if exclude_id is not None:
            query = query.filter(Project.id != exclude_id)
        if query.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def list_projects(profile: Profile) -> list[Project]:
    return pc.list_scoped(Project, profile_id=profile.id)


def get_project(profile: Profile, entity_id: uuid.UUID) -> Project | None:
    return pc.get_scoped(Project, entity_id, profile_id=profile.id)


def create_project(profile: Profile, fields: dict[str, Any], technologies: list[str]) -> Project:
    fields = dict(fields)
    base_slug = slugify(fields.get("slug") or fields["title"])
    fields["slug"] = unique_slug(base_slug)
    project = pc.create_scoped(Project, fields, profile_id=profile.id)
    sync_technologies(project, technologies)
    return project


def update_project(entity: Project, fields: dict[str, Any], technologies: list[str]) -> Project:
    fields = dict(fields)
    base_slug = slugify(fields.get("slug") or fields["title"])
    fields["slug"] = unique_slug(base_slug, exclude_id=entity.id)
    pc.update_entity(entity, fields)
    sync_technologies(entity, technologies)
    return entity


def delete_project(entity: Project) -> None:
    pc.delete_entity(entity)


def reorder_projects(profile: Profile, ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(Project, ordered_ids, profile_id=profile.id)


def move_project(profile: Profile, entity: Project, direction: str) -> None:
    pc.move(Project, entity, direction, profile_id=profile.id)


def sync_technologies(project: Project, names: list[str]) -> None:
    """Replace `project.technologies` with rows built from `names`, in order.

    Existing rows are deleted (cascade handles the delete-orphan cleanup)
    and recreated rather than diffed, since technology tags have no other
    identity/relationships worth preserving across an edit.
    """

    cleaned = [name.strip() for name in names if name.strip()]
    for existing in list(project.technologies):
        db.session.delete(existing)
    db.session.flush()
    for index, name in enumerate(cleaned):
        db.session.add(ProjectTechnology(project_id=project.id, name=name, display_order=index))
    db.session.commit()


def list_public_projects() -> list[Project]:
    """Every visible project across the (single) profile, for the sitemap.

    Mirrors `get_public_project_by_slug`'s `visible=True` filter so a hidden
    project's detail URL is never listed as a discoverable/indexable page.
    """

    return db.session.query(Project).filter_by(visible=True).order_by(Project.display_order).all()


def get_public_project_by_slug(slug: str) -> Project | None:
    """The single visible project matching `slug`, or None.

    Used by the public project-detail route. Filters on `visible=True` at
    the query layer (rather than relying on a template-level check, the way
    list pages do) so an admin who has hidden a project - or a slug that
    never existed - both come back as "not found" (404), not a leaked 200
    with hidden content.
    """

    return db.session.query(Project).filter_by(slug=slug, visible=True).first()


def technologies_to_text(project: Project) -> str:
    return ", ".join(tech.name for tech in project.technologies)


def parse_technologies_text(text: str) -> list[str]:
    return [part.strip() for part in text.split(",") if part.strip()]
