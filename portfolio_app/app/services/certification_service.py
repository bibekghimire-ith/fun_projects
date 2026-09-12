"""Certification CRUD + reordering, scoped to a Profile."""

from __future__ import annotations

import uuid
from typing import Any

from app.models.certification import Certification
from app.models.profile import Profile
from app.services import portfolio_content as pc


def list_certifications(profile: Profile) -> list[Certification]:
    return pc.list_scoped(Certification, profile_id=profile.id)


def get_certification(profile: Profile, entity_id: uuid.UUID) -> Certification | None:
    return pc.get_scoped(Certification, entity_id, profile_id=profile.id)


def create_certification(profile: Profile, fields: dict[str, Any]) -> Certification:
    return pc.create_scoped(Certification, fields, profile_id=profile.id)


def update_certification(entity: Certification, fields: dict[str, Any]) -> Certification:
    return pc.update_entity(entity, fields)


def delete_certification(entity: Certification) -> None:
    pc.delete_entity(entity)


def reorder_certifications(profile: Profile, ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(Certification, ordered_ids, profile_id=profile.id)


def move_certification(profile: Profile, entity: Certification, direction: str) -> None:
    pc.move(Certification, entity, direction, profile_id=profile.id)
