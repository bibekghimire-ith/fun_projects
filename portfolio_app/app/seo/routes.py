"""Blog discovery/SEO surface (Phase 6): robots.txt, sitemap.xml, rss.xml.

Exact paths per docs/API_SPEC.md: `GET /robots.txt`, `GET /sitemap.xml`,
`GET /rss.xml`. Kept in their own domain package (`app/seo/`, already
scaffolded empty since Phase 0's repository layout) rather than folded into
`app/public/routes.py`, per the architecture skill's "isolate domains" rule
- these three routes are a distinct concern (search-engine/feed-reader
consumption of the site) from the human-facing public pages, even though
they read the exact same content through the exact same services.

Absolute URLs (sitemap `<loc>`, RSS `<link>`/`<guid>`, OpenGraph `og:url` in
app/public/routes.py) are built from the configured `BASE_URL`
(app/config.py), never from the incoming request's `Host` header - using an
attacker-controlled `Host` header to build URLs that get echoed back into a
machine-readable feed/sitemap is exactly the kind of "unsafe redirect"/SSRF-
adjacent surface CLAUDE.md's threat model calls out; `BASE_URL` is an
operator-configured, trusted value.
"""

from __future__ import annotations

from datetime import UTC, datetime
from xml.sax.saxutils import escape

from flask import Blueprint, Response, current_app, url_for

from app.services import (
    blog_category_service,
    blog_service,
    blog_tag_service,
    project_service,
)

seo_bp = Blueprint("seo", __name__)

# Endpoints that make up the static (non-parametrized) public portfolio
# surface, for the sitemap - mirrors app/services/nav_service.py's
# ALLOWED_NAV_ENDPOINTS list (the authoritative "what public pages exist"
# list), minus the blog endpoints (handled separately below, since those
# are enumerated dynamically from published content) - see
# docs/DECISIONS.md for why this list is duplicated narrowly here rather
# than importing nav_service's allowlist directly (that list also includes
# the blog index, which this module treats specially).
_STATIC_PORTFOLIO_ENDPOINTS = (
    "public.home",
    "public.about",
    "public.experience",
    "public.education",
    "public.skills",
    "public.projects",
    "public.certifications",
    "public.achievements",
    "public.resume",
    "public.contact",
)


def _base_url() -> str:
    return current_app.config.get("BASE_URL", "").rstrip("/")


def _absolute(endpoint: str, **kwargs) -> str:
    return f"{_base_url()}{url_for(endpoint, **kwargs)}"


def _rfc822(dt: datetime) -> str:
    # RFC 822 / RFC 2822 date format required by RSS 2.0's pubDate. Defensive
    # UTC-assume for a naive value, matching BlogPost.is_publicly_visible's
    # own defensive handling (SQLite's `DateTime(timezone=True)` doesn't
    # actually enforce tz-awareness on read the way PostgreSQL's does - see
    # app/models/blog.py).
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.strftime("%a, %d %b %Y %H:%M:%S %z")


@seo_bp.get("/robots.txt")
def robots_txt():
    """Disallow admin/auth, allow everything else, point at the sitemap.

    `/admin/` and `/auth/` are the entire non-public surface of this
    application (see app/admin/routes.py and app/auth/routes.py) - nothing
    else needs disallowing since every other route is already
    unauthenticated, publicly-visible content by design (Phase 4/5's
    visibility-filtered query layer).
    """

    lines = [
        "User-agent: *",
        "Disallow: /admin/",
        "Disallow: /auth/",
        "Allow: /",
        f"Sitemap: {_absolute('seo.sitemap_xml')}",
    ]
    return Response("\n".join(lines) + "\n", mimetype="text/plain")


@seo_bp.get("/sitemap.xml")
def sitemap_xml():
    """XML sitemap covering the static portfolio pages, every publicly-
    visible project/blog post, and every category/tag page that currently
    has at least one publicly-visible post - draft/scheduled-in-the-future
    posts and admin/auth routes are never included, since every URL here
    comes from the same visibility-filtered service functions the public
    routes themselves use (`blog_service.list_public_posts`,
    `project_service.list_public_projects`), not a raw table scan.
    """

    entries: list[tuple[str, datetime | None]] = []

    for endpoint in _STATIC_PORTFOLIO_ENDPOINTS:
        entries.append((_absolute(endpoint), None))

    for project in project_service.list_public_projects():
        entries.append((_absolute("public.project_detail", slug=project.slug), project.updated_at))

    entries.append((_absolute("public.blog_home"), None))

    public_posts = blog_service.list_public_posts()
    for post in public_posts:
        entries.append((_absolute("public.blog_detail", slug=post.slug), post.updated_at))

    categories_with_posts = {
        post.category_id for post in public_posts if post.category_id is not None
    }
    for category in blog_category_service.list_categories():
        if category.id in categories_with_posts:
            entries.append(
                (_absolute("public.blog_category", slug=category.slug), category.updated_at)
            )

    tags_with_posts = {tag.id for post in public_posts for tag in post.tags}
    for tag in blog_tag_service.list_tags():
        if tag.id in tags_with_posts:
            entries.append((_absolute("public.blog_tag", slug=tag.slug), tag.updated_at))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for loc, lastmod in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(loc)}</loc>")
        if lastmod is not None:
            lines.append(f"    <lastmod>{lastmod.date().isoformat()}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return Response("\n".join(lines) + "\n", mimetype="application/xml")


@seo_bp.get("/rss.xml")
def rss_xml():
    """RSS 2.0 feed of the most recent publicly-visible posts.

    Capped at the 20 most recent (this app's scale doesn't need a full-
    history feed, and an unbounded feed is its own minor resource-exhaustion
    surface); only ever built from `blog_service.list_public_posts()`, the
    same visibility-filtered query every other public blog view uses, so a
    draft/future-scheduled post can never leak into the feed.
    """

    posts = blog_service.list_public_posts()[:20]
    now = datetime.now(UTC)

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<rss version="2.0">')
    lines.append("  <channel>")
    lines.append("    <title>Blog</title>")
    lines.append(f"    <link>{escape(_absolute('public.blog_home'))}</link>")
    lines.append("    <description>Articles, notes, and write-ups.</description>")
    lines.append("    <language>en-us</language>")
    lines.append(f"    <lastBuildDate>{_rfc822(now)}</lastBuildDate>")
    for post in posts:
        link = _absolute("public.blog_detail", slug=post.slug)
        description = post.excerpt or post.title
        pub_date = post.effective_publish_at()
        lines.append("    <item>")
        lines.append(f"      <title>{escape(post.title)}</title>")
        lines.append(f"      <link>{escape(link)}</link>")
        lines.append(f'      <guid isPermaLink="true">{escape(link)}</guid>')
        if pub_date is not None:
            lines.append(f"      <pubDate>{_rfc822(pub_date)}</pubDate>")
        lines.append(f"      <description>{escape(description)}</description>")
        lines.append("    </item>")
    lines.append("  </channel>")
    lines.append("</rss>")
    return Response("\n".join(lines) + "\n", mimetype="application/rss+xml")
