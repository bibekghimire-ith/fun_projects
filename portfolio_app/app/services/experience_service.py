"""Experience CRUD + reordering, scoped to a Profile."""

from __future__ import annotations

import uuid
from typing import Any

from app.models.experience import Experience
from app.models.profile import Profile
from app.services import portfolio_content as pc


def list_experiences(profile: Profile) -> list[Experience]:
    return pc.list_scoped(Experience, profile_id=profile.id)


def get_experience(profile: Profile, entity_id: uuid.UUID) -> Experience | None:
    return pc.get_scoped(Experience, entity_id, profile_id=profile.id)


def create_experience(profile: Profile, fields: dict[str, Any]) -> Experience:
    return pc.create_scoped(Experience, fields, profile_id=profile.id)


def update_experience(entity: Experience, fields: dict[str, Any]) -> Experience:
    return pc.update_entity(entity, fields)


def delete_experience(entity: Experience) -> None:
    pc.delete_entity(entity)


def reorder_experiences(profile: Profile, ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(Experience, ordered_ids, profile_id=profile.id)


def move_experience(profile: Profile, entity: Experience, direction: str) -> None:
    pc.move(Experience, entity, direction, profile_id=profile.id)
