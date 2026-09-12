"""Education CRUD + reordering, scoped to a Profile."""

from __future__ import annotations

import uuid
from typing import Any

from app.models.education import Education
from app.models.profile import Profile
from app.services import portfolio_content as pc


def list_educations(profile: Profile) -> list[Education]:
    return pc.list_scoped(Education, profile_id=profile.id)


def get_education(profile: Profile, entity_id: uuid.UUID) -> Education | None:
    return pc.get_scoped(Education, entity_id, profile_id=profile.id)


def create_education(profile: Profile, fields: dict[str, Any]) -> Education:
    return pc.create_scoped(Education, fields, profile_id=profile.id)


def update_education(entity: Education, fields: dict[str, Any]) -> Education:
    return pc.update_entity(entity, fields)


def delete_education(entity: Education) -> None:
    pc.delete_entity(entity)


def reorder_educations(profile: Profile, ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(Education, ordered_ids, profile_id=profile.id)


def move_education(profile: Profile, entity: Education, direction: str) -> None:
    pc.move(Education, entity, direction, profile_id=profile.id)
