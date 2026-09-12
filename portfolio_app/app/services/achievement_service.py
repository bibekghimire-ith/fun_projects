"""Achievement CRUD + reordering, scoped to a Profile."""

from __future__ import annotations

import uuid
from typing import Any

from app.models.achievement import Achievement
from app.models.profile import Profile
from app.services import portfolio_content as pc


def list_achievements(profile: Profile) -> list[Achievement]:
    return pc.list_scoped(Achievement, profile_id=profile.id)


def get_achievement(profile: Profile, entity_id: uuid.UUID) -> Achievement | None:
    return pc.get_scoped(Achievement, entity_id, profile_id=profile.id)


def create_achievement(profile: Profile, fields: dict[str, Any]) -> Achievement:
    return pc.create_scoped(Achievement, fields, profile_id=profile.id)


def update_achievement(entity: Achievement, fields: dict[str, Any]) -> Achievement:
    return pc.update_entity(entity, fields)


def delete_achievement(entity: Achievement) -> None:
    pc.delete_entity(entity)


def reorder_achievements(profile: Profile, ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(Achievement, ordered_ids, profile_id=profile.id)


def move_achievement(profile: Profile, entity: Achievement, direction: str) -> None:
    pc.move(Achievement, entity, direction, profile_id=profile.id)
