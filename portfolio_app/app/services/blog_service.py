"""BlogPost CRUD, slugging, Markdown rendering, and publish/schedule state.

Publishing state machine (see app/models/blog.py's `BlogPost.
is_publicly_visible` for the actual visibility computation, and
docs/DECISIONS.md for the full write-up):

- `create_post` / `update_post` always leave `status` alone unless the
  caller explicitly changes it - a plain save never publishes or hides a
  post.
- `publish_post` sets `status="published"` and, only if `published_at` is
  still unset, stamps it with "now" - re-publishing an already-published
  post does not bump its publish date.
- `unpublish_post` sets `status="draft"` - `published_at` is deliberately
  left untouched (audit trail of when it was first published), it simply
  stops mattering while `status == "draft"`.
- `schedule_post` sets `status="scheduled"` and `scheduled_at` to the given
  future-or-past timestamp; `published_at` is cleared so the *scheduled*
  timestamp is what governs visibility until the post is published for
  real. Scheduling a timestamp in the past is allowed on purpose - it is
  exactly how the exit criteria's "a past-dated scheduled post IS public"
  check is proven: there is no cron/worker that "runs" a schedule, visibility
  is computed from the timestamp at read time (see `list_public_posts`).

Every create/update call renders `markdown_body` through
`app/services/markdown_service.render_markdown` and stores the sanitized
result in `rendered_body` (sanitize-on-save - docs/DECISIONS.md), so no
public route ever renders raw Markdown or un-sanitized HTML.
"""

from __future__ import annotations

import math
import re
import uuid
from datetime import datetime
from typing import Any

from app.common.pagination import Page, paginate
from app.extensions import db
from app.models.base import utcnow
from app.models.blog import BlogCategory, BlogPost, BlogPostStatus, BlogTag
from app.services import markdown_service
from app.services.blog_tag_service import assign_tags

_SLUG_INVALID = re.compile(r"[^a-z0-9]+")
_HTML_TAG = re.compile(r"<[^>]+>")

# Reading-time constant (Phase 6). 225 words per minute is a commonly cited
# average adult silent-reading speed for prose (the widely used range is
# ~200-250 wpm; 225 is the midpoint) - see docs/DECISIONS.md for the full
# write-up of why this value and not, say, 200 or 265.
READING_SPEED_WORDS_PER_MINUTE = 225


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = _SLUG_INVALID.sub("-", value).strip("-")
    return value or "post"


def unique_slug(base: str, exclude_id: uuid.UUID | None = None) -> str:
    candidate = base
    suffix = 2
    while True:
        query = db.session.query(BlogPost).filter_by(slug=candidate)
        if exclude_id is not None:
            query = query.filter(BlogPost.id != exclude_id)
        if query.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def list_posts(*, status: str | None = None) -> list[BlogPost]:
    """All posts for the admin list view, most recently updated first."""

    query = db.session.query(BlogPost)
    if status:
        query = query.filter_by(status=status)
    return query.order_by(BlogPost.updated_at.desc()).all()


def get_post(entity_id: uuid.UUID) -> BlogPost | None:
    return db.session.query(BlogPost).filter_by(id=entity_id).first()


def get_post_by_slug(slug: str) -> BlogPost | None:
    return db.session.query(BlogPost).filter_by(slug=slug).first()


def _apply_fields(post: BlogPost, fields: dict[str, Any]) -> None:
    for key, value in fields.items():
        setattr(post, key, value)
    post.rendered_body = markdown_service.render_markdown(post.markdown_body)


def create_post(
    author_id: uuid.UUID | None, fields: dict[str, Any], tag_names: list[str]
) -> BlogPost:
    fields = dict(fields)
    base_slug = slugify(fields.get("slug") or fields["title"])
    fields["slug"] = unique_slug(base_slug)
    post = BlogPost(author_id=author_id, status=BlogPostStatus.DRAFT.value)
    _apply_fields(post, fields)
    db.session.add(post)
    db.session.commit()
    assign_tags(post, tag_names)
    return post


def update_post(post: BlogPost, fields: dict[str, Any], tag_names: list[str]) -> BlogPost:
    fields = dict(fields)
    base_slug = slugify(fields.get("slug") or fields["title"])
    fields["slug"] = unique_slug(base_slug, exclude_id=post.id)
    _apply_fields(post, fields)
    db.session.commit()
    assign_tags(post, tag_names)
    return post


def delete_post(post: BlogPost) -> None:
    db.session.delete(post)
    db.session.commit()


def publish_post(post: BlogPost) -> BlogPost:
    post.status = BlogPostStatus.PUBLISHED.value
    if post.published_at is None:
        post.published_at = utcnow()
    db.session.commit()
    return post


def unpublish_post(post: BlogPost) -> BlogPost:
    post.status = BlogPostStatus.DRAFT.value
    db.session.commit()
    return post


def schedule_post(post: BlogPost, scheduled_at: datetime) -> BlogPost:
    post.status = BlogPostStatus.SCHEDULED.value
    post.scheduled_at = scheduled_at
    post.published_at = None
    db.session.commit()
    return post


def preview_html(markdown_body: str) -> str:
    """Render (but do not persist) sanitized HTML for the admin preview pane."""

    return markdown_service.render_markdown(markdown_body)


# --- Public, visibility-filtered queries ------------------------------------
#
# Every function below applies the exact same "is this post publicly visible
# right now" rule as `BlogPost.is_publicly_visible` - implemented here as a
# SQL-level filter (not a Python-side check after fetching everything) so a
# draft or not-yet-scheduled post's row is never even returned to the public
# routes, matching `project_service.get_public_project_by_slug`'s "filter at
# the query layer" precedent (docs/IMPLEMENTATION_STATE.md, Phase 4).


def _visible_query(now: datetime | None = None):
    current = now or utcnow()
    return (
        db.session.query(BlogPost)
        .filter(BlogPost.status != BlogPostStatus.DRAFT.value)
        .filter(
            db.or_(
                BlogPost.published_at.isnot(None) & (BlogPost.published_at <= current),
                BlogPost.scheduled_at.isnot(None) & (BlogPost.scheduled_at <= current),
            )
        )
    )


def list_public_posts(now: datetime | None = None) -> list[BlogPost]:
    """Publicly visible posts, most recently effective-published first."""

    posts = _visible_query(now).all()
    posts.sort(key=lambda p: p.effective_publish_at() or utcnow(), reverse=True)
    return posts


def get_public_post_by_slug(slug: str, now: datetime | None = None) -> BlogPost | None:
    post = get_post_by_slug(slug)
    if post is None or not post.is_publicly_visible(now):
        return None
    return post


def list_public_posts_by_category(
    category: BlogCategory, now: datetime | None = None
) -> list[BlogPost]:
    return [post for post in list_public_posts(now) if post.category_id == category.id]


def list_public_posts_by_tag(tag: BlogTag, now: datetime | None = None) -> list[BlogPost]:
    return [post for post in list_public_posts(now) if tag.id in {t.id for t in post.tags}]


def search_public_posts(query_text: str, now: datetime | None = None) -> list[BlogPost]:
    """Publicly visible posts whose title/excerpt/body contain `query_text`.

    A simple case-insensitive substring match (`ILIKE`/its SQLite
    equivalent) across three columns - deliberately not a search-engine
    dependency (Elasticsearch/Postgres full-text/etc.) per
    docs/MASTER_PROMPT.md's "no external API dependency for core
    functionality" and this app's scale (a single-admin blog). See
    docs/DECISIONS.md for the full rationale. Only ever queries through the
    same visibility filter every other public query function uses, so a
    draft/hidden post can never surface via search regardless of how closely
    its content matches.
    """

    query_text = query_text.strip()
    if not query_text:
        return []
    like = f"%{query_text}%"
    posts = (
        _visible_query(now)
        .filter(
            db.or_(
                BlogPost.title.ilike(like),
                BlogPost.excerpt.ilike(like),
                BlogPost.markdown_body.ilike(like),
            )
        )
        .all()
    )
    posts.sort(key=lambda p: p.effective_publish_at() or utcnow(), reverse=True)
    return posts


# --- Pagination wrappers (Phase 6) ------------------------------------------
#
# Each of the four public listing views (blog home, category, tag, search)
# gets a `*_page` wrapper returning an `app.common.pagination.Page` - see
# that module's docstring for why pagination happens over the already-
# filtered Python list rather than in SQL at this app's scale.


def list_public_posts_page(page: int, per_page: int, now: datetime | None = None) -> Page[BlogPost]:
    return paginate(list_public_posts(now), page, per_page)


def list_public_posts_by_category_page(
    category: BlogCategory, page: int, per_page: int, now: datetime | None = None
) -> Page[BlogPost]:
    return paginate(list_public_posts_by_category(category, now), page, per_page)


def list_public_posts_by_tag_page(
    tag: BlogTag, page: int, per_page: int, now: datetime | None = None
) -> Page[BlogPost]:
    return paginate(list_public_posts_by_tag(tag, now), page, per_page)


def search_public_posts_page(
    query_text: str, page: int, per_page: int, now: datetime | None = None
) -> Page[BlogPost]:
    return paginate(search_public_posts(query_text, now), page, per_page)


# --- Related posts + reading time (Phase 6) ---------------------------------


def related_posts(post: BlogPost, limit: int = 3, now: datetime | None = None) -> list[BlogPost]:
    """Up to `limit` other publicly-visible posts related to `post`.

    Heuristic (documented in docs/DECISIONS.md): a candidate must share
    at least one tag or the same category with `post`; candidates are then
    ranked by (tag-overlap-count, same-category, most-recent-effective-
    publish-first), highest first. This rewards posts that overlap on more
    tags over posts that merely share a category, while still surfacing
    same-category posts with no tag overlap at all as a fallback, and never
    includes `post` itself or a non-public post (it is built directly on
    `list_public_posts`, the same visibility-filtered source every other
    public query uses).
    """

    tag_ids = {t.id for t in post.tags}
    scored: list[tuple[int, int, datetime, BlogPost]] = []
    for candidate in list_public_posts(now):
        if candidate.id == post.id:
            continue
        overlap = len({t.id for t in candidate.tags} & tag_ids)
        same_category = 1 if (post.category_id and candidate.category_id == post.category_id) else 0
        if overlap == 0 and same_category == 0:
            continue
        effective = candidate.effective_publish_at() or utcnow()
        scored.append((overlap, same_category, effective, candidate))
    scored.sort(key=lambda entry: (entry[0], entry[1], entry[2]), reverse=True)
    return [entry[3] for entry in scored[:limit]]


def reading_time_minutes(post: BlogPost) -> int:
    """Estimated reading time in whole minutes, minimum 1.

    Word count is taken from `rendered_body` with HTML tags stripped
    (falling back to `markdown_body` if `rendered_body` hasn't been
    populated yet, e.g. an admin-preview call site) - counting rendered text
    rather than raw Markdown avoids Markdown syntax characters (`#`, `` ` ``,
    link brackets) inflating the word count. See
    `READING_SPEED_WORDS_PER_MINUTE`'s docstring for the wpm constant
    chosen.
    """

    text = post.rendered_body or post.markdown_body or ""
    plain_text = _HTML_TAG.sub(" ", text)
    word_count = len(plain_text.split())
    if word_count == 0:
        return 1
    return max(1, math.ceil(word_count / READING_SPEED_WORDS_PER_MINUTE))
