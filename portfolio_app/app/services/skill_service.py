"""SkillCategory (global) and Skill (scoped to a category) CRUD + reordering.

Per docs/DATABASE_DESIGN.md, `SkillCategory` carries no `profile_id` - see
app/models/skill.py's docstring and docs/DECISIONS.md.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.models.skill import Skill, SkillCategory
from app.services import portfolio_content as pc

# --- Skill categories (global, unscoped list) -------------------------------


def list_skill_categories() -> list[SkillCategory]:
    return pc.list_scoped(SkillCategory)


def get_skill_category(entity_id: uuid.UUID) -> SkillCategory | None:
    return pc.get_scoped(SkillCategory, entity_id)


def create_skill_category(fields: dict[str, Any]) -> SkillCategory:
    return pc.create_scoped(SkillCategory, fields)


def update_skill_category(entity: SkillCategory, fields: dict[str, Any]) -> SkillCategory:
    return pc.update_entity(entity, fields)


def delete_skill_category(entity: SkillCategory) -> None:
    pc.delete_entity(entity)


def reorder_skill_categories(ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(SkillCategory, ordered_ids)


def move_skill_category(entity: SkillCategory, direction: str) -> None:
    pc.move(SkillCategory, entity, direction)


# --- Skills (scoped to a category) ------------------------------------------


def list_skills(category: SkillCategory) -> list[Skill]:
    return pc.list_scoped(Skill, category_id=category.id)


def get_skill(category: SkillCategory, entity_id: uuid.UUID) -> Skill | None:
    return pc.get_scoped(Skill, entity_id, category_id=category.id)


def create_skill(category: SkillCategory, fields: dict[str, Any]) -> Skill:
    return pc.create_scoped(Skill, fields, category_id=category.id)


def update_skill(entity: Skill, fields: dict[str, Any]) -> Skill:
    return pc.update_entity(entity, fields)


def delete_skill(entity: Skill) -> None:
    pc.delete_entity(entity)


def reorder_skills(category: SkillCategory, ordered_ids: list[uuid.UUID]) -> None:
    pc.reorder_scoped(Skill, ordered_ids, category_id=category.id)


def move_skill(category: SkillCategory, entity: Skill, direction: str) -> None:
    pc.move(Skill, entity, direction, category_id=category.id)
