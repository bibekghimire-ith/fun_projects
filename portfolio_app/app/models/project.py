"""Project and ProjectTechnology models."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, OrderingMixin, TimestampMixin, VisibilityMixin


class Project(Base, TimestampMixin, OrderingMixin, VisibilityMixin):
    __tablename__ = "projects"

    profile_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True, index=True)
    short_description: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    github_url: Mapped[str | None] = mapped_column(String(500))
    demo_url: Mapped[str | None] = mapped_column(String(500))
    documentation_url: Mapped[str | None] = mapped_column(String(500))
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    profile = relationship("Profile", back_populates="projects")
    technologies = relationship(
        "ProjectTechnology",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectTechnology.display_order",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Project {self.title!r}>"


class ProjectTechnology(Base, OrderingMixin):
    __tablename__ = "project_technologies"

    project_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    project = relationship("Project", back_populates="technologies")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ProjectTechnology {self.name!r}>"
