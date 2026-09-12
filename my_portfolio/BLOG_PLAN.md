# Blogging Expansion Plan

Status: **implemented.** Everything described below has been built:
`Post`/`PostView` models, Markdown rendering + sanitization
(`app/markdown_utils.py`), the public blog (`app/routers/blog.py`), admin
post CRUD + analytics (in `app/routers/admin.py`), CSRF protection across
every admin form, server-side field validation, security response headers,
and retro-styled templates with image thumbnails. This document is kept
as the design record — see `IMPLEMENTATION_PLAN.md` for the up-to-date
status list and `README.md` / `ADMIN_README.md` for user-facing docs. The
plan below is unchanged from when it was written, so it still explains the
reasoning behind specific choices (why login is CSRF-exempt, why analytics
only ever stores a date + a count, etc.) even though the phased rollout it
describes is now complete.

This was the design for turning the portfolio (site settings, projects,
skills, experience, education) into one that also supports a blog, with
Markdown authoring, built-in analytics, strict field validation, and
secure-by-default handling of user-supplied content. It was written so
each phase could be implemented and shipped independently.

## Goals

- Write posts in Markdown, rendered to HTML safely (no stored XSS).
- See basic analytics per post (views over time) without adding a
  third-party tracker, cookies, or storing visitor PII — consistent with
  this being a small personal site, not an ad-funded one.
- Every new form field is validated (length limits, required-ness,
  uniqueness) the same way existing Project/Experience/Education fields
  are, so bad input fails loudly in the admin UI instead of silently
  corrupting data.
- Visual design matches the existing retro theme exactly — no new colors,
  fonts, or components; blog cards reuse `.card` / `.card-image` from
  Projects.
- No architecture changes outside additive files — this plan touches
  `models.py`, adds new routers/templates, and extends `admin.py`; it does
  not restructure anything that already exists.

## 1. Data model

```python
class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    summary: Mapped[str] = mapped_column(String(300), default="")          # shown on cards, in RSS
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)     # source of truth, edited in admin
    content_html: Mapped[str] = mapped_column(Text, default="")             # rendered + sanitized cache
    cover_image_url: Mapped[str] = mapped_column(String(500), default="")
    tags: Mapped[str] = mapped_column(String(300), default="")             # comma-separated, same pattern as Project.tech_stack
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    view_count: Mapped[int] = mapped_column(Integer, default=0)             # fast counter; daily breakdown lives in PostView
    order_index: Mapped[int] = mapped_column(Integer, default=0)           # manual override; default sort is published_at desc


class PostView(Base):
    """One row per (post, day) — enough for a views-over-time chart without
    storing a row per pageview or anything that identifies a visitor."""
    __tablename__ = "post_views"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)     # UTC calendar day
    count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (UniqueConstraint("post_id", "day", name="uq_post_views_post_day"),)
```

Why no `Tag` table: every other list-of-tags field in this codebase
(`Project.tech_stack`) is a plain comma-separated string, not a join table.
Matching that keeps the blog consistent with the rest of the app and avoids
a many-to-many model for something that's just used to render pills and do
simple substring filtering. If tag filtering ever needs to be a first-class
feature (tag pages with counts, autocomplete), revisit then — it's an
additive change, not a rewrite.

Why `PostView` is per-day-per-post, not per-pageview: storing one row per
visit means storing *something* to dedupe by (IP, cookie, fingerprint) —
which immediately becomes a privacy/PII problem and a GDPR question for a
personal site that shouldn't need either. A day-bucketed counter gives a
real "views over time" chart with zero visitor-identifying data stored, at
the cost of not being able to de-duplicate repeat views from the same
person within a day. That trade-off is the right one here — see the
Analytics section below.

Since `Post` and `PostView` are **new tables**, `Base.metadata.create_all()`
(already called in `app/database.py::init_db`) creates them automatically
on next startup, on both a fresh database and your existing one — no
manual migration needed. (That's different from the background/text color
work, which added *columns* to an existing table — `create_all()` only
creates missing tables, never adds columns to ones that already exist,
which is why that needed the small `_run_column_migrations` step. A brand
new table has no such gap.)

## 2. Markdown rendering and sanitization (security-critical)

Markdown → HTML is the one part of this feature that can introduce stored
XSS if done carelessly, so it gets its own section.

- **Library:** `markdown` (Python-Markdown) with the `fenced_code`,
  `tables`, `toc`, and `codehilite` extensions — fenced code blocks and
  tables are table-stakes for a technical blog, `codehilite` gives syntax
  highlighting via Pygments.
- **Sanitize the rendered HTML before it's ever stored**, using `nh3`
  (a maintained Rust-backed HTML sanitizer; the modern replacement for the
  now-unmaintained `bleach`) with an explicit allowlist: standard text
  formatting, headings, lists, blockquotes, code/pre, tables, links, and
  images — no `<script>`, no inline event handlers (`onclick` etc.), no
  `style` attribute, no raw `<iframe>`/`<object>`/`<embed>`. Links get
  `rel="noopener noreferrer"` and, since this is single-admin content
  authored by you, still sanitized as defense-in-depth (protects against a
  compromised admin session, a bug in a Markdown extension, or a future
  second admin account).
- **Render once, at save time**, not per page view: `content_html` is
  computed and sanitized in the admin create/update handler and stored
  alongside `content_markdown`. The public blog routes just read
  `content_html` — no Markdown parsing or sanitization on the request path,
  which is both faster and means the sanitizer only ever runs against
  input that already passed through the authenticated admin form.
- **Size cap:** reject `content_markdown` over a generous but finite limit
  (e.g. 200 KB) in the admin form handler — prevents an accidental paste of
  something huge from bloating the database or the rendering step.
- Template output uses `{{ post.content_html | safe }}` — the *only* place
  in the app that opts out of Jinja2's autoescaping, and only because the
  HTML reaching it has already been through the sanitizer above. Everywhere
  else keeps Jinja2's default escaping as-is.

## 3. Analytics (privacy-preserving, no third-party tracker)

- **What gets recorded:** on each public `GET /blog/{slug}` request, the
  server increments `Post.view_count` and upserts today's `PostView` row
  for that post (`INSERT ... ON CONFLICT (post_id, day) DO UPDATE SET
  count = count + 1`, or the SQLAlchemy equivalent). That's it — no
  cookies, no client-side script, no IP address, user agent, or referrer
  stored anywhere.
- **What doesn't get recorded, on purpose:** visitor IPs, session/device
  fingerprints, referrers, geolocation, or anything that could identify a
  person. This isn't a compliance workaround — it's that a personal
  portfolio blog has no real use for per-visitor tracking, and not
  collecting data you don't need is the simplest way to have nothing to
  protect, leak, or explain in a privacy policy.
- **Admin analytics view** (`/admin/analytics`): total views, a simple
  per-post table (title, total views, views in the last 7/30 days), and a
  small views-over-time chart per post rendered from `PostView` rows —
  plain HTML/CSS bars in keeping with the retro theme, no charting library
  needed for this scale of data.
- **Bot/scraper noise:** acceptable to leave uncorrected in phase 1 (a
  personal blog doesn't need bot-filtering infrastructure); worth revisiting
  only if the numbers become obviously meaningless later.
- **Explicitly out of scope:** Google Analytics/Plausible/Umami/any
  external script. If you later want richer analytics (unique visitors,
  device/browser breakdown, geography), that's a deliberate trade-off
  against the privacy stance above — flag it as its own decision rather
  than defaulting into it.

## 4. Field validation

Every new form follows the existing pattern in `app/routers/admin.py`
(`Form(...)` required fields, explicit defaults, slug uniqueness loop like
`Project`) plus these additions specific to posts:

| Field | Validation |
|---|---|
| `title` | required, 1–200 chars |
| `slug` | auto-generated from title via `slugify` (same helper already used for projects), uniqueness enforced with the same suffix-counter pattern as `Project.slug` |
| `summary` | optional, ≤300 chars |
| `content_markdown` | required, non-empty, ≤200 KB |
| `cover_image_url` / `cover_image_file` | same pattern as `Project.image_url` / `image_file` — reuses `app/uploads.py`'s existing extension allowlist + 5MB cap, no new upload code path needed |
| `tags` | optional, ≤300 chars, comma-separated (same shape as `Project.tech_stack`) |
| `published` | checkbox → bool, same pattern as `Project.featured` |
| `published_at` | if `published` is checked and `published_at` is blank, default to "now" server-side rather than requiring the admin to fill it in |

Validation errors re-render the form with the submitted values and an
inline error message instead of a raw 500 — matching how
`change_password_submit` already handles its own validation errors.

## 5. Routes

**Public** (`app/routers/blog.py`, new file, included in `main.py` the same
way `public.py` and `admin.py` are):

- `GET /blog` — paginated list of published posts, newest first (or by
  `order_index` if you want manual override), card grid reusing
  `.card`/`.card-image` with the cover image shown when present.
- `GET /blog/{slug}` — full post; 404s if the post doesn't exist *or*
  isn't published (so unpublished posts aren't reachable by guessing a
  slug); increments the view counters described above.
- `GET /blog/rss.xml` — a minimal RSS 2.0 feed of published posts (title,
  link, summary, pubDate) — cheap to add, standard practice for a blog,
  and gives you something concrete to point a feed reader at.
- Nav bar gets a "blog" link alongside the existing home/projects/experience.

**Admin** (extending `app/routers/admin.py`):

- `GET /admin/posts` — list with cover-image thumbnail (same
  `.admin-thumb` pattern as the projects table), published/draft status,
  view count, edit/delete actions.
- `GET/POST /admin/posts/new`, `GET/POST /admin/posts/{id}/edit` — the
  Markdown editor is a plain `<textarea>` (no JS-heavy WYSIWYG editor,
  consistent with "minimal") with a "preview" link that opens the rendered
  post in a new tab after saving — simplest thing that works.
- `POST /admin/posts/{id}/delete`
- `POST /admin/posts/{id}/toggle-published` — quick publish/unpublish
  without opening the full edit form.
- `GET /admin/analytics` — the views dashboard from section 3.

## 6. Templates / retro styling

- `templates/public/blog_list.html` — same `.grid` of `.card` elements as
  `projects.html`, with `.card-image` shown when `post.cover_image_url` is
  set (identical pattern to the Projects thumbnail work already shipped).
- `templates/public/blog_detail.html` — post title, cover image, meta line
  (published date, tags as `.tag` pills — same component projects use),
  then `{{ post.content_html | safe }}` inside a `.prose`-style content
  block. `retro.css` gets a small addition for that block only: heading
  sizes, code block background using `--bg-panel`, blockquote left-border
  using `--accent` — everything sourced from the existing three theme
  variables, nothing new to configure.
- `templates/admin/posts_list.html`, `templates/admin/post_form.html`,
  `templates/admin/analytics.html` — same structure/classes as the
  existing `admin/projects_list.html`, `admin/project_form.html`.
- No new fonts, colors, or layout primitives — this phase is pure content,
  reusing every visual building block that already exists.

## 7. Secure coding practices (cross-cutting, not just for blog)

Specific to this feature:

- Markdown → sanitized HTML, rendered once at save time (section 2).
- File upload validation reused as-is from `app/uploads.py` — no new upload
  code path, no new attack surface there.
- Slug-based lookups use SQLAlchemy's parameterized queries throughout
  (already the case everywhere in this codebase) — no raw SQL string
  interpolation anywhere in the new routes.
- Unpublished posts 404 rather than redirect-to-login or otherwise leak
  their existence to an unauthenticated visitor.
- Analytics collects nothing that identifies a visitor (section 3) — the
  simplest way to avoid a whole category of data-handling risk.

Worth fixing while touching this area, even though it predates the blog
feature:

- **No CSRF protection on admin forms today.** Every admin POST route
  (settings, projects, skills, experience, education, and the new post
  routes) relies solely on the session cookie for auth, with no CSRF
  token. Since the session cookie is `SameSite=Lax` (set in `main.py`),
  classic cross-site `<form>` CSRF is partially mitigated for top-level
  navigations, but not for all request types, and it's a gap worth closing
  properly rather than relying on `SameSite` alone — especially once
  there's more state-changing surface area (blog CRUD) to protect. Suggest
  adding a lightweight CSRF token (e.g. `starlette-wtf`, or a minimal
  hand-rolled double-submit-cookie token in `app/security.py`) shared by
  every admin form. This is bigger than the blog feature and is called out
  here so it doesn't get silently scoped in as "just for posts" — it
  should protect all admin forms, existing and new, in one pass.
- Consider basic security response headers (`X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY` or a `frame-ancestors` CSP directive,
  `Referrer-Policy: same-origin`) via a small Starlette middleware — cheap
  defense-in-depth, unrelated to Markdown specifically but a natural thing
  to add while hardening this area of the app.

## 8. Testing plan

Following the existing `tests/test_smoke.py` style (FastAPI `TestClient`,
no mocking framework):

- Markdown → HTML rendering produces expected sanitized output; a
  malicious input (`<script>`, `onerror=`, `javascript:` link) is stripped.
- Slug uniqueness/auto-generation matches the existing `Project` test
  pattern.
- Unpublished post detail route 404s for an unauthenticated client.
- View counter increments on each detail-page request (published post
  only).
- Admin post CRUD is gated by `require_admin` the same way project CRUD
  already is tested.
- RSS feed is well-formed XML and lists only published posts.

## 9. Suggested phasing

Each phase is independently shippable and testable:

1. **Model + admin CRUD** — `Post`/`PostView` models, Markdown rendering +
   sanitization, admin list/create/edit/delete/toggle-publish. No public
   routes yet — verify content authoring end-to-end first.
2. **Public blog pages** — `/blog`, `/blog/{slug}`, retro-styled templates,
   thumbnails, nav link.
3. **Analytics** — view counting on the detail route, `/admin/analytics`
   dashboard.
4. **Nice-to-haves** — RSS feed, tag-based filtering/pages, pagination
   controls if the post count grows past one page.
5. **Cross-cutting hardening** — CSRF tokens across all admin forms,
   security response headers (can land any time after phase 1; not
   blocking, but shouldn't be forgotten).

## 10. New dependencies

```
markdown==3.7
nh3==0.2.18
pygments==2.18.0
```

All pure-Python/Rust-wheel packages with no system dependencies beyond what
the existing `Dockerfile` already installs — no Dockerfile changes needed
beyond the `requirements.txt` addition.
