"""Blog CMS models (Phase 5).

Per docs/DATABASE_DESIGN.md: `BlogCategory`, `BlogTag`, `BlogPost`, and the
`BlogPostTag` many-to-many association. `BlogPost.status` follows the same
"plain column + CHECK constraint" convention `User.role` established in
Phase 1 (docs/DECISIONS.md #12) rather than a normalized lookup table -
exactly three values (`draft`/`published`/`scheduled`) are needed and no
other table references them.

Scheduling is a computed-at-query-time abstraction, not a background job:
`BlogPost.is_publicly_visible(now)` is the single source of truth for "is
this post visible on the public site right now", used identically by the
public blog routes' listing/detail queries and by tests - see
app/services/blog_service.py and docs/DECISIONS.md for the full rationale.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base, TimestampMixin, utcnow
from app.models.user import User  # noqa: F401 - ensures FK target is registered


class BlogPostStatus(str, enum.Enum):
    """Publication status. See the module docstring for how visibility is
    actually computed (it is not simply `status == "published"`)."""

    DRAFT = "draft"
    PUBLISHED = "published"
    SCHEDULED = "scheduled"


class BlogCategory(Base, TimestampMixin):
    __tablename__ = "blog_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500))

    posts = relationship("BlogPost", back_populates="category")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<BlogCategory {self.name!r}>"


class BlogTag(Base, TimestampMixin):
    __tablename__ = "blog_tags"

    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(70), nullable=False, unique=True, index=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<BlogTag {self.name!r}>"


# Association table for BlogPost <-> BlogTag. A composite primary key
# (post_id, tag_id) *is* the "unique(post_id, tag_id)" constraint
# docs/DATABASE_DESIGN.md asks for - no separate id/timestamps are needed
# since this row carries no data of its own beyond the link, matching the
# `ProjectTechnology`-vs-plain-list precedent of not over-modeling a pure
# join (docs/DECISIONS.md #20 discusses the analogous tradeoff).
blog_post_tags = Table(
    "blog_post_tags",
    Base.metadata,
    Column("post_id", GUID(), ForeignKey("blog_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", GUID(), ForeignKey("blog_tags.id", ondelete="CASCADE"), primary_key=True),
)


class BlogPost(Base, TimestampMixin):
    __tablename__ = "blog_posts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published', 'scheduled')", name="ck_blog_posts_status_valid"
        ),
    )

    author_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), nullable=False, unique=True, index=True)
    excerpt: Mapped[str | None] = mapped_column(String(500))
    markdown_body: Mapped[str] = mapped_column(Text, nullable=False)
    # Sanitized HTML rendered from markdown_body - see app/services/
    # markdown_service.py. Populated on every create/update (sanitize-on-save,
    # docs/DECISIONS.md), never rendered from raw markdown at request time.
    rendered_body: Mapped[str | None] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(String(500))
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("blog_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=BlogPostStatus.DRAFT.value, index=True
    )
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    seo_title: Mapped[str | None] = mapped_column(String(200))
    seo_description: Mapped[str | None] = mapped_column(String(300))
    canonical_url: Mapped[str | None] = mapped_column(String(500))

    author = relationship("User")
    category = relationship("BlogCategory", back_populates="posts")
    tags = relationship("BlogTag", secondary=blog_post_tags, order_by="BlogTag.name")

    def effective_publish_at(self) -> datetime | None:
        """The timestamp that governs public visibility.

        `published_at` takes precedence (an explicitly-published post is
        never re-hidden by a stale `scheduled_at`); falls back to
        `scheduled_at` for posts that are still in "scheduled" status.
        """

        return self.published_at or self.scheduled_at

    def is_publicly_visible(self, now: datetime | None = None) -> bool:
        """True once this post's effective timestamp has passed.

        This is the scheduling abstraction: there is no background job that
        flips a post from "scheduled" to "published" - visibility is simply
        computed at query/request time from `status` + the effective
        timestamp, so a post scheduled in the past is immediately public and
        one scheduled in the future is not, with no extra process involved.
        """

        if self.status == BlogPostStatus.DRAFT.value:
            return False
        effective = self.effective_publish_at()
        if effective is None:
            return False
        current = now or utcnow()
        if effective.tzinfo is None:
            # Defensive: all datetimes in this app are UTC-aware (TimestampMixin
            # convention); a naive value would only occur via a direct DB write.
            from datetime import UTC

            effective = effective.replace(tzinfo=UTC)
        return effective <= current

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<BlogPost {self.title!r} status={self.status!r}>"
