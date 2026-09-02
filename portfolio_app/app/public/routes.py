"""Public-facing portfolio blueprint (Phase 4).

Renders the currently active theme (app/services/template_service) against
the real Phase 2 portfolio content models, through the exact same shared
Jinja macros (app/templates/base/_content_components.html) and shared
layout skeleton (app/templates/themes/_layout.html) Phase 3 built - see
docs/DECISIONS.md for why Phase 4 uses one shared page template per page
(not five theme-specific variants) with the theme's own CSS
(app/static/css/themes/<key>.css) providing the visual distinction, exactly
like CLAUDE.md rule #17 ("do not duplicate portfolio data for each theme")
already required.

Every route here is read-only and unauthenticated by design - this is the
public site. VisibilityMixin/OrderingMixin filtering happens in the shared
macros themselves (`| selectattr("visible")`, and relationships are already
ordered by `display_order` - see app/models/profile.py) and, for the
project-detail route, at the query layer
(`project_service.get_public_project_by_slug`), so an inactive/hidden item
is never rendered publicly regardless of which theme is active.
"""

from __future__ import annotations

from flask import Blueprint, abort, current_app, render_template, request, send_file, url_for

from app.common.storage import InvalidStorageReferenceError, get_storage_adapter
from app.extensions import limiter
from app.public.forms import ContactForm
from app.services import (
    blog_category_service,
    blog_service,
    blog_tag_service,
    contact_service,
    nav_service,
    profile_service,
    project_service,
    resume_service,
    skill_service,
    template_service,
)
from app.templates_engine import registry

public_bp = Blueprint("public", __name__)


def _page_context(
    active_endpoint: str, *, title: str, description: str, canonical_url: str | None = None
) -> dict:
    """Context every public page needs: active theme, profile, nav, resume.

    Centralized so every route below builds its page-specific context on
    top of this rather than repeating theme/nav/profile lookups (and so a
    future addition to what every public page needs - e.g. SEO metadata -
    is a one-place change).
    """

    profile = profile_service.get_public_profile()
    active_row = template_service.get_active_template()
    theme = registry.get_theme(active_row.key)
    resume = resume_service.get_resume(profile) if profile else None
    return {
        "theme": theme,
        "profile": profile,
        "resume": resume,
        "nav_items": nav_service.list_visible_nav_items(),
        "active_endpoint": active_endpoint,
        "page_title": title,
        "meta_description": description,
        "canonical_url": canonical_url,
    }


@public_bp.get("/")
def home():
    ctx = _page_context(
        "public.home",
        title="Home",
        description="Portfolio home page - experience, projects, and skills at a glance.",
    )
    return render_template("public/home.html", **ctx)


@public_bp.get("/about")
def about():
    ctx = _page_context(
        "public.about", title="About", description="About the person behind this portfolio."
    )
    return render_template("public/about.html", **ctx)


@public_bp.get("/experience")
def experience():
    ctx = _page_context(
        "public.experience", title="Experience", description="Professional work experience."
    )
    return render_template("public/experience.html", **ctx)


@public_bp.get("/education")
def education():
    ctx = _page_context("public.education", title="Education", description="Academic background.")
    return render_template("public/education.html", **ctx)


@public_bp.get("/skills")
def skills():
    ctx = _page_context("public.skills", title="Skills", description="Skills and expertise.")
    ctx["skill_categories"] = skill_service.list_skill_categories()
    return render_template("public/skills.html", **ctx)


@public_bp.get("/projects")
def projects():
    ctx = _page_context("public.projects", title="Projects", description="A selection of projects.")
    return render_template("public/projects.html", **ctx)


@public_bp.get("/projects/<slug>")
def project_detail(slug: str):
    project = project_service.get_public_project_by_slug(slug)
    if project is None:
        abort(404)
    ctx = _page_context(
        "public.projects",
        title=project.title,
        description=project.short_description or project.title,
    )
    ctx["project"] = project
    return render_template("public/project_detail.html", **ctx)


@public_bp.get("/certifications")
def certifications():
    ctx = _page_context(
        "public.certifications", title="Certifications", description="Professional certifications."
    )
    return render_template("public/certifications.html", **ctx)


@public_bp.get("/achievements")
def achievements():
    ctx = _page_context(
        "public.achievements", title="Achievements", description="Notable achievements and awards."
    )
    return render_template("public/achievements.html", **ctx)


@public_bp.get("/resume")
def resume():
    ctx = _page_context("public.resume", title="Resume", description="View or download the resume.")
    return render_template("public/resume.html", **ctx)


@public_bp.route("/contact", methods=["GET", "POST"])
@limiter.limit(lambda: current_app.config.get("CONTACT_RATE_LIMIT", "5 per hour"))
def contact():
    """Public contact page + form handler (Phase 7).

    Server-side validation/CSRF come from `ContactForm` being a `FlaskForm`
    (same convention every other form in this app uses). Rate limiting
    reuses the exact `@limiter.limit(lambda: ...)` pattern
    app/auth/routes.py's login route established (docs/DECISIONS.md #14),
    now applied to `CONTACT_RATE_LIMIT`. A filled honeypot field
    (`form.website.data`) is treated as spam: the message is silently
    dropped (never persisted, never emailed) but the response still looks
    like success - not revealing to a bot which field tipped it off - see
    docs/DECISIONS.md.
    """

    form = ContactForm()
    if form.validate_on_submit():
        if form.website.data:
            current_app.logger.info("contact_honeypot_triggered")
        else:
            record = contact_service.create_message(
                name=form.name.data,
                email=form.email.data,
                subject=form.subject.data,
                message=form.message.data,
                ip_address=request.remote_addr,
            )
            contact_service.notify_new_message(current_app, record)
        ctx = _page_context("public.contact", title="Contact", description="Get in touch.")
        ctx["form"] = ContactForm(formdata=None)
        ctx["submitted"] = True
        return render_template("public/contact.html", **ctx)

    ctx = _page_context("public.contact", title="Contact", description="Get in touch.")
    ctx["form"] = form
    ctx["submitted"] = False
    return render_template("public/contact.html", **ctx)


@public_bp.get("/media/<stored_name>")
def media_file(stored_name: str):
    """Serve a locally-stored uploaded image back publicly.

    `stored_name` is always a randomized, extension-only name the storage
    adapter generated itself (never user-supplied path input) - the
    adapter's `path_for()` re-validates that shape and that the resolved
    path stays inside the configured storage directory before this route
    ever touches the filesystem (see app/common/storage.py). No admin
    auth is required to *view* an uploaded image (matching every other
    *_url-style public asset in this app, e.g. a project's image_url) -
    only uploading requires admin_required (app/admin/routes.py).
    """

    storage = get_storage_adapter(current_app)
    try:
        path = storage.path_for(stored_name)
    except InvalidStorageReferenceError:
        abort(404)
    if not path.exists():
        abort(404)
    return send_file(path)


# --- Blog (Phase 5 + Phase 6 discovery/SEO) ---------------------------------
#
# Every route below only ever queries through app/services/blog_service.py's
# `list_public_posts*`/`get_public_post_by_slug`/`search_public_posts*` (and
# the category/tag equivalents) - the same "filter visibility at the query
# layer" pattern `project_service.get_public_project_by_slug` established in
# Phase 4, so a draft or not-yet-scheduled post is unreachable here even if
# its exact slug is known/guessed, not merely omitted from a listing.
#
# Pagination (this phase): `page`/`per_page` query params, `per_page` clamped
# to `[1, MAX_BLOG_PER_PAGE]` so a visitor can't force an unbounded query via
# the URL; a `page` beyond the last page of a non-empty result set 404s
# (`Page.is_out_of_range` - see app/common/pagination.py) rather than
# silently clamping or rendering an empty page, so a listing page never
# claims "no results" for a query that actually has some, just not on that
# page. Page 1 of a genuinely empty result set (no posts at all, or no
# matches) renders normally with the existing empty-state message.

DEFAULT_BLOG_PER_PAGE = 10
MAX_BLOG_PER_PAGE = 50


def _pagination_args() -> tuple[int, int]:
    """Parse+clamp `page`/`per_page` from the query string.

    Non-numeric/missing values fall back to their defaults rather than
    erroring - a malformed pagination param is a cosmetic/UX concern, not
    something worth a 400 for on a public content page.
    """

    try:
        page = int(request.args.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    page = max(page, 1)

    try:
        per_page = int(request.args.get("per_page", DEFAULT_BLOG_PER_PAGE))
    except (TypeError, ValueError):
        per_page = DEFAULT_BLOG_PER_PAGE
    per_page = max(1, min(per_page, MAX_BLOG_PER_PAGE))

    return page, per_page


def _post_seo_context(post) -> dict:
    """SEO title/description/canonical for a single post, falling back to
    the post's own title/excerpt/canonical_url when SEO fields are unset -
    see docs/DECISIONS.md's Phase 5 entry."""

    return {
        "title": post.seo_title or post.title,
        "description": post.seo_description or post.excerpt or post.title,
        "canonical_url": post.canonical_url,
    }


def _og_context(post) -> dict:
    """OpenGraph/Twitter Card metadata for a single post (Phase 6).

    `og:image` falls back to the site's own profile image when the post has
    no `cover_image_url` set, so a shared link still gets a preview image
    where possible rather than omitting `og:image` outright; if neither is
    set, no image tag is rendered at all (no fabricated/placeholder image
    URL) - see docs/DECISIONS.md for the fallback chain.
    """

    profile = profile_service.get_public_profile()
    base_url = current_app.config.get("BASE_URL", "").rstrip("/")
    image = post.cover_image_url or (profile.profile_image_url if profile else None)
    return {
        "og_title": post.seo_title or post.title,
        "og_description": post.seo_description or post.excerpt or post.title,
        "og_url": f"{base_url}{url_for('public.blog_detail', slug=post.slug)}",
        "og_image": image,
        "og_site_name": (profile.display_name if profile and profile.display_name else "Portfolio"),
    }


@public_bp.get("/blog")
def blog_home():
    page, per_page = _pagination_args()
    result = blog_service.list_public_posts_page(page, per_page)
    if result.is_out_of_range:
        abort(404)
    ctx = _page_context(
        "public.blog_home", title="Blog", description="Articles, notes, and write-ups."
    )
    ctx["posts"] = result.items
    ctx["pagination"] = result
    ctx["pagination_endpoint"] = "public.blog_home"
    ctx["pagination_kwargs"] = {}
    ctx["reading_time"] = {p.id: blog_service.reading_time_minutes(p) for p in result.items}
    return render_template("public/blog_list.html", **ctx)


@public_bp.get("/blog/search")
def blog_search():
    page, per_page = _pagination_args()
    query_text = (request.args.get("q") or "").strip()
    posts: list = []
    pagination = None
    if query_text:
        result = blog_service.search_public_posts_page(query_text, page, per_page)
        if result.is_out_of_range:
            abort(404)
        posts = result.items
        pagination = result
    ctx = _page_context(
        "public.blog_home",
        title="Search results" if query_text else "Search",
        description=(f"Search results for '{query_text}'." if query_text else "Search the blog."),
    )
    ctx["posts"] = posts
    ctx["pagination"] = pagination
    ctx["pagination_endpoint"] = "public.blog_search"
    ctx["pagination_kwargs"] = {"q": query_text}
    ctx["search_query"] = query_text
    ctx["heading"] = f"Search results for “{query_text}”" if query_text else "Search"
    ctx["reading_time"] = {p.id: blog_service.reading_time_minutes(p) for p in posts}
    return render_template("public/blog_search.html", **ctx)


@public_bp.get("/blog/<slug>")
def blog_detail(slug: str):
    post = blog_service.get_public_post_by_slug(slug)
    if post is None:
        abort(404)
    ctx = _page_context("public.blog_home", **_post_seo_context(post))
    ctx["post"] = post
    ctx["reading_time_value"] = blog_service.reading_time_minutes(post)
    ctx["related_posts"] = blog_service.related_posts(post)
    ctx.update(_og_context(post))
    return render_template("public/blog_detail.html", **ctx)


@public_bp.get("/blog/category/<slug>")
def blog_category(slug: str):
    category = blog_category_service.get_category_by_slug(slug)
    if category is None:
        abort(404)
    page, per_page = _pagination_args()
    result = blog_service.list_public_posts_by_category_page(category, page, per_page)
    if result.is_out_of_range:
        abort(404)
    ctx = _page_context(
        "public.blog_home",
        title=f"Category: {category.name}",
        description=category.description or f"Posts in {category.name}.",
    )
    ctx["posts"] = result.items
    ctx["pagination"] = result
    ctx["pagination_endpoint"] = "public.blog_category"
    ctx["pagination_kwargs"] = {"slug": category.slug}
    ctx["heading"] = f"Category: {category.name}"
    ctx["reading_time"] = {p.id: blog_service.reading_time_minutes(p) for p in result.items}
    return render_template("public/blog_list.html", **ctx)


@public_bp.get("/blog/tag/<slug>")
def blog_tag(slug: str):
    tag = blog_tag_service.get_tag_by_slug(slug)
    if tag is None:
        abort(404)
    page, per_page = _pagination_args()
    result = blog_service.list_public_posts_by_tag_page(tag, page, per_page)
    if result.is_out_of_range:
        abort(404)
    ctx = _page_context(
        "public.blog_home", title=f"Tag: {tag.name}", description=f"Posts tagged {tag.name}."
    )
    ctx["posts"] = result.items
    ctx["pagination"] = result
    ctx["pagination_endpoint"] = "public.blog_tag"
    ctx["pagination_kwargs"] = {"slug": tag.slug}
    ctx["heading"] = f"Tag: {tag.name}"
    ctx["reading_time"] = {p.id: blog_service.reading_time_minutes(p) for p in result.items}
    return render_template("public/blog_list.html", **ctx)
