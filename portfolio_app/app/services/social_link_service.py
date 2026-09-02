"""SocialLink CRUD + reordering, scoped to a Profile."""

from __future__ import annotations

import uuid
from typing import Any

from app.models.profile import Profile, SocialLink
from app.services import portfolio_content as pc


def list_social_links(profile: Profile) -> list[SocialLink]:
    return pc.list_scoped(SocialLink, profile_id=profile.id)


def get_social_link(profile: Profile, entity_id: uuid.UUID) -> SocialLink | None:
    return pc.get_scoped(SocialLink, entity_id, profile_id=profile.id)


def create_social_link(profile: Profile, fields: dict[str, Any]) -> SocialLink:
    return pc.create_scoped(SocialLink, fields, profile_id=profile.id)


def update_social_link(entity: SocialLink, fields: dict[str, Any]) -> SocialLink:
    return pc.update_entity(entity, fields)


def delete_social_link(entity: SocialLink) -> None:
    pc.delete_entity(entity)


def reorder_social_links(profile: Profile, ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(SocialLink, ordered_ids, profile_id=profile.id)


def move_social_link(profile: Profile, entity: SocialLink, direction: str) -> None:
    pc.move(SocialLink, entity, direction, profile_id=profile.id)
