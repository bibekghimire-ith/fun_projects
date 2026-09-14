"""Database models.

Design notes for future expansion (e.g. blogging):
- SiteSettings is a single-row table holding site-wide, admin-editable config.
- Every content table has an `order_index` so the admin panel can let the
  user drag/reorder without touching primary keys.
- Adding a `Post` / `Tag` model later is a self-contained addition; nothing
  here needs to change to support it.
"""
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SiteSettings(Base):
    """Singleton row (id=1) holding the site's configurable content."""

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    site_title: Mapped[str] = mapped_column(String(120), default="My Portfolio")
    tagline: Mapped[str] = mapped_column(String(200), default="Software / Hardware Engineer")
    bio: Mapped[str] = mapped_column(Text, default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    resume_url: Mapped[str] = mapped_column(String(500), default="")
    footer_text: Mapped[str] = mapped_column(String(300), default="")

    email: Mapped[str] = mapped_column(String(200), default="")
    location: Mapped[str] = mapped_column(String(120), default="")
    github_url: Mapped[str] = mapped_column(String(500), default="")
    linkedin_url: Mapped[str] = mapped_column(String(500), default="")
    twitter_url: Mapped[str] = mapped_column(String(500), default="")

    # Retro theme is minimal by design, but background/text/accent are all
    # configurable from the admin panel without touching CSS files. Panel
    # background, borders, and dimmed text are derived from these three at
    # render time (see base.html) rather than stored separately.
    #
    # Defaults below match https://www.causehouse.co (an Awwwards-featured
    # site) — cream background, dark green-black text, lime accent.
    background_color: Mapped[str] = mapped_column(String(20), default="#F7F0E6")
    text_color: Mapped[str] = mapped_column(String(20), default="#1D2B1F")
    accent_color: Mapped[str] = mapped_column(String(20), default="#BFEA4B")
    theme: Mapped[str] = mapped_column(String(30), default="retro-green")


class SkillCategory(Base):
    __tablename__ = "skill_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    skills: Mapped[list["Skill"]] = relationship(
        back_populates="category", cascade="all, delete-orphan", order_by="Skill.order_index"
    )


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("skill_categories.id"))
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=80)  # 0-100, shown as a retro meter
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped["SkillCategory"] = relationship(back_populates="skills")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False, index=True)
    summary: Mapped[str] = mapped_column(String(300), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    tech_stack: Mapped[str] = mapped_column(String(300), default="")  # comma-separated
    repo_url: Mapped[str] = mapped_column(String(500), default="")
    live_url: Mapped[str] = mapped_column(String(500), default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def tech_list(self) -> list[str]:
        return [t.strip() for t in self.tech_stack.split(",") if t.strip()]


class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[str] = mapped_column(String(150), nullable=False)
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    location: Mapped[str] = mapped_column(String(120), default="")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    @property
    def is_current(self) -> bool:
        return self.end_date is None


class Education(Base):
    __tablename__ = "education"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution: Mapped[str] = mapped_column(String(150), nullable=False)
    degree: Mapped[str] = mapped_column(String(150), default="")
    field: Mapped[str] = mapped_column(String(150), default="")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class Post(Base):
    """A blog post. `content_markdown` is the source of truth (edited in
    /admin); `content_html` is the sanitized HTML rendered from it at save
    time — see app/markdown_utils.py. Public routes only ever read
    `content_html`, never re-render Markdown on the request path.
    """

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, nullable=False, index=True)
    summary: Mapped[str] = mapped_column(String(300), default="")
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_html: Mapped[str] = mapped_column(Text, default="")
    cover_image_url: Mapped[str] = mapped_column(String(500), default="")
    tags: Mapped[str] = mapped_column(String(300), default="")  # comma-separated, same pattern as Project.tech_stack
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    # Set only for posts created by the feed ingestion pipeline; blank for
    # hand-written posts. See FEED_INGESTION_PLAN.md.
    source_name: Mapped[str] = mapped_column(String(200), default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")

    @property
    def tag_list(self) -> list[str]:
        return [t.strip() for t in self.tags.split(",") if t.strip()]


class FeedSource(Base):
    """One configured website/category feed the ingestion pipeline polls
    for new articles. See FEED_INGESTION_PLAN.md for the full design.
    """

    __tablename__ = "feed_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    feed_url: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    extra_tags: Mapped[str] = mapped_column(String(300), default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    max_items_per_run: Mapped[int] = mapped_column(Integer, default=10)
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[str] = mapped_column(String(20), default="")
    last_error: Mapped[str] = mapped_column(String(500), default="")
    last_imported_count: Mapped[int] = mapped_column(Integer, default=0)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def tag_list(self) -> list[str]:
        tags = [self.category.strip()] if self.category and self.category.strip() else []
        tags += [t.strip() for t in self.extra_tags.split(",") if t.strip()]
        # De-duplicate while preserving order (category first).
        seen: set[str] = set()
        unique = []
        for tag in tags:
            key = tag.lower()
            if key not in seen:
                seen.add(key)
                unique.append(tag)
        return unique


class IngestedItem(Base):
    """Dedup ledger: one row per feed entry ever seen for a given source,
    whether or not it became a Post. Kept separate from Post so dedup
    survives a post being edited or deleted (FEED_INGESTION_PLAN.md
    section 3)."""

    __tablename__ = "ingested_items"
    __table_args__ = (UniqueConstraint("source_id", "guid", name="uq_ingested_source_guid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("feed_sources.id"), nullable=False)
    guid: Mapped[str] = mapped_column(String(500), nullable=False)
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="imported")
    detail: Mapped[str] = mapped_column(String(300), default="")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PostView(Base):
    """One row per (post, UTC calendar day) — enough for a views-over-time
    chart without ever storing anything that identifies a visitor (no IP,
    no cookie, no user agent). See BLOG_PLAN.md section 3 for the reasoning.
    """

    __tablename__ = "post_views"
    __table_args__ = (UniqueConstraint("post_id", "day", name="uq_post_views_post_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0)
