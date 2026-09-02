"""SkillCategory and Skill models.

Per docs/DATABASE_DESIGN.md, `SkillCategory` has no `profile_id` - it is a
shared taxonomy rather than per-profile content (consistent with there being
exactly one administrator/portfolio in this application; see
docs/DECISIONS.md).
"""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, OrderingMixin, VisibilityMixin


class SkillCategory(Base, OrderingMixin, VisibilityMixin):
    __tablename__ = "skill_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    skills = relationship(
        "Skill",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="Skill.display_order",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<SkillCategory {self.name!r}>"


class Skill(Base, OrderingMixin, VisibilityMixin):
    __tablename__ = "skills"
    __table_args__ = (
        CheckConstraint(
            "proficiency >= 1 AND proficiency <= 5", name="ck_skills_proficiency_range"
        ),
    )

    category_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("skill_categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 1 (beginner) - 5 (expert); see docs/DECISIONS.md for why an integer
    # scale was chosen over a free-text field.
    proficiency: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50))

    category = relationship("SkillCategory", back_populates="skills")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Skill {self.name!r}>"
