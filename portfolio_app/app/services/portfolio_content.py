"""Generic CRUD + reordering engine for ordered, scoped portfolio content.

Every Phase 2 child entity (SocialLink, Experience, Education, Project,
Certification, Achievement, Skill, ProjectTechnology, and the unscoped
SkillCategory) follows the same shape: rows belong to some parent (a
profile_id/category_id/project_id column, or no scope at all for the global
SkillCategory list) and carry an explicit `display_order` (see
app/models/base.py's `OrderingMixin`). Rather than duplicating list/get/
create/update/delete/reorder for each entity, the per-entity service modules
(app/services/experience_service.py etc.) are thin, clearly-named wrappers
around the functions here.

The `get_scoped` function is the IDOR guard used by every admin route: it
filters by id *and* the owning scope column in a single query, so a request
for an id that exists but belongs to someone else's data (or a different
project/category) comes back as "not found", never leaking existence or
letting a client-supplied id bypass ownership.
"""

from __future__ import annotations

import uuid
from typing import Any, TypeVar, cast

from sqlalchemy import func

from app.extensions import db

T = TypeVar("T")


def list_scoped(model: type[T], **scope: Any) -> list[T]:
    """Return all rows matching `scope`, ordered by `display_order`."""

    return db.session.query(model).filter_by(**scope).order_by(model.display_order).all()  # type: ignore[attr-defined]


def get_scoped(model: type[T], entity_id: uuid.UUID, **scope: Any) -> T | None:
    """Fetch one row by id, scoped to the given parent - the ownership check.

    Returns None (never raises) when the row doesn't exist or doesn't match
    the scope, so callers can treat "not found" and "not yours" identically.
    """

    return db.session.query(model).filter_by(id=entity_id, **scope).first()


def create_scoped(model: type[T], fields: dict[str, Any], **scope: Any) -> T:
    """Create a row, appending it to the end of its scope's display order."""

    max_order = db.session.query(func.max(model.display_order)).filter_by(**scope).scalar()  # type: ignore[attr-defined]
    next_order = 0 if max_order is None else max_order + 1
    entity = model(**scope, display_order=next_order, **fields)  # type: ignore[call-arg]
    db.session.add(entity)
    db.session.commit()
    return entity


def update_entity(entity: T, fields: dict[str, Any]) -> T:
    """Apply a validated field dict to an already-fetched, ownership-checked entity."""

    for key, value in fields.items():
        setattr(entity, key, value)
    db.session.commit()
    return entity


def delete_entity(entity: Any) -> None:
    db.session.delete(entity)
    db.session.commit()


def reorder_scoped(model: type[T], ordered_ids: list[uuid.UUID], **scope: Any) -> None:
    """Reassign dense `display_order` values (0..n-1) following `ordered_ids`.

    `ordered_ids` must contain exactly the ids currently in this scope - no
    more, no fewer - so a caller cannot smuggle in another parent's row id
    (IDOR) and cannot silently drop a row by omitting it. Raises ValueError
    on any mismatch; callers should treat that as a 400/422, not a 500.
    """

    items = list_scoped(model, **scope)
    by_id: dict[Any, Any] = {cast(Any, item).id: item for item in items}
    if set(ordered_ids) != set(by_id):
        raise ValueError("ordered_ids must match the current set of item ids exactly")

    for index, item_id in enumerate(ordered_ids):
        by_id[item_id].display_order = index
    db.session.commit()


def move(model: type[T], entity: Any, direction: str, **scope: Any) -> None:
    """Swap `entity`'s display_order with its immediate neighbor.

    `direction` is "up" (earlier) or "down" (later). A no-op at either end
    of the list. This gives fully keyboard-/screen-reader-accessible
    reordering (two submit buttons) without requiring JavaScript drag-and-
    drop, per CLAUDE.md's accessibility rule.
    """

    items = list_scoped(model, **scope)
    entity_any = cast(Any, entity)
    index = next((i for i, item in enumerate(items) if cast(Any, item).id == entity_any.id), None)
    if index is None:
        raise ValueError("entity is not part of the given scope")

    if direction == "up" and index > 0:
        neighbor = cast(Any, items[index - 1])
    elif direction == "down" and index < len(items) - 1:
        neighbor = cast(Any, items[index + 1])
    else:
        return

    entity_any.display_order, neighbor.display_order = (
        neighbor.display_order,
        entity_any.display_order,
    )
    db.session.commit()
