# Implementation State

## Current phase
Phase 0 — Foundation: **complete**, with one exit-criterion verified by
substitution rather than directly (see "Not verified" below).

Phase 1 — Authentication: **complete**. Admin can log in; unauthenticated
users cannot access admin routes — verified both by an automated test suite
and by an end-to-end run against a real PostgreSQL server (see
"Verification performed" below).

Phase 2 — Portfolio content: **complete**. Admin can manage Profile, Social
Links, Experience, Education, Skill Categories/Skills, Projects (with an
ordered technology list), Certifications, Achievements, and Resume entirely
through the admin UI — with ordering, visibility, CSRF, and server-side
IDOR/ownership checks throughout. Verified by an automated test suite and by
an end-to-end curl-driven CRUD/reorder/delete run against a real Gunicorn +
PostgreSQL server (see "Verification performed" below).

Phase 3 — Template engine: **complete**. Five built-in themes (Minimal
Developer, Modern Professional, Cybersecurity/Engineering, Academic/
Research, Creative) exist as Jinja2 template sets sharing one macro layer
over the exact same Phase 2 content models; a code-level registry + a
DB-backed `PortfolioTemplate` table track which templates exist and which
one is active; the admin can list/preview/switch the active template
through `/admin/templates`; dark/light mode works across all five themes.
The exit criterion ("switching templates changes presentation without
changing content") is verified directly by an automated test that renders
the same Profile/Experience content under two different active templates
and asserts the DB rows are unchanged while the HTML differs, and again
end-to-end against a real Gunicorn + PostgreSQL server (see "Verification
performed" below). Full public-facing pages remain Phase 4 scope — Phase 3
only had to prove the rendering infrastructure and same-content-different-
presentation guarantee, not build every page.

Phase 4 — Public portfolio: **complete**. The public site (Home, About,
Experience, Education, Skills, Projects list + detail, Certifications,
Achievements, Resume, Contact placeholder, and a themed 404) is live and
unauthenticated, rendering the real Phase 2 content through whichever
theme is currently active (Phase 3), with admin-configurable navigation.
Verified by an automated test suite (visibility filtering, ordering,
project-detail 404s, all five themes rendering all ten pages without
error, nav configuration reflected, accessibility basics) and by an
end-to-end curl-driven run against a real Gunicorn + PostgreSQL server
that created real content through the admin UI and confirmed it on the
public site, including switching themes live (see "Verification
performed" below).

Phase 5 — Blog CMS: **complete**. Admin can create, edit, and delete blog
posts (Markdown body, excerpt, cover image URL, category, tags, SEO
title/description, canonical URL, featured flag, slug management); save
drafts; preview the sanitized rendered HTML inline on the edit form and as
a full-page admin preview; publish/unpublish; schedule a post for a future
or past timestamp; manage categories and tags. The public site exposes an
unpaginated blog list, post detail (sanitized HTML, syntax-highlighted code,
SEO meta tags/canonical link/OpenGraph tags), a category page, and a tag
page - all rendered through the existing Phase 3/4 theme system (same
shared macros/layout, all five themes). The exit criterion ("admin can
publish and manage articles") is verified by an automated test suite and by
an end-to-end curl-driven run against a real Gunicorn + PostgreSQL server
that created a draft, confirmed it was not public, published it, confirmed
it appeared publicly with sanitized HTML/SEO tags, and proved the
scheduling abstraction (a future-scheduled post stayed hidden, a
past-scheduled post was immediately public) — see "Verification performed"
below. Pagination, search, RSS, sitemap, and related posts are explicitly
Phase 6 scope and were not built.

Phase 6 — Blog discovery/SEO: **complete**. The public blog now has
pagination (`page`/`per_page` query params, prev/next links, out-of-range
404 handling), search (`GET /blog/search?q=...`, a simple case-insensitive
`ILIKE` across title/excerpt/body), category and tag pages (now paginated),
related posts on the post-detail page (shared-tag/category heuristic),
reading-time estimates (list + detail), an RSS 2.0 feed (`GET /rss.xml`), an
XML sitemap (`GET /sitemap.xml`) covering the static portfolio pages plus
every publicly-visible project/post/category/tag page, `GET /robots.txt`
disallowing `/admin/`/`/auth/`, and OpenGraph/Twitter Card metadata on post
detail pages (with an image fallback chain). The exit criterion ("blog is
search-engine friendly and discoverable") is verified by an automated test
suite (pagination boundaries, search matches/exclusions, category/tag
pagination + visibility, related-posts heuristic, reading-time calculation,
RSS/sitemap well-formedness and content correctness, robots.txt content, OG/
Twitter tag presence) and by an end-to-end curl-driven run against a real
Gunicorn + PostgreSQL server that created a published post, a true draft, a
future-scheduled post, and a past-scheduled post through the admin UI and
confirmed via live HTTP requests that only the published and past-scheduled
posts appear in `/blog`, `/sitemap.xml`, and `/rss.xml` — see "Verification
performed" below. No schema changes were needed (no new migration).

Phase 7 — Contact and media: **complete**. The Phase 4 contact page's
inert placeholder form is now fully wired: `POST /contact` validates
server-side (required fields, email format, length limits), is
CSRF-protected (the form is a `FlaskForm`), rate-limited
(`CONTACT_RATE_LIMIT`, same Flask-Limiter pattern as login), and rejects
bot-like submissions via a honeypot field (dropped silently, not a visible
validation error). Every valid submission is persisted as a `ContactMessage`
row regardless of whether email is configured; a best-effort notification
is sent through a configurable `EmailAdapter` (console/log adapter by
default, an SMTP adapter selectable via `MAIL_PROVIDER=smtp`) that never
raises back into the request and never exposes SMTP credentials/admin email
in any response. The admin can triage messages (list/filter by status,
view detail, mark read/archived, delete) at `/admin/messages`. A general-
purpose local-filesystem media upload endpoint (`/admin/media`,
admin-only) validates uploads by sniffing actual file content (not
filename/Content-Type), enforces a size limit and an image-only allowlist,
stores files under safe randomized names outside any executable path, and
serves them back at `/media/<stored_name>` with path-traversal-proof
lookup; a `StorageAdapter` interface keeps the local implementation
swappable for a future S3-compatible backend with no caller changes. The
exit criterion ("contact flow works without exposing secrets") is verified
by an automated test suite and by an end-to-end curl-driven run against a
real Gunicorn + PostgreSQL server — see "Verification performed" below.

Phase 8 — Production hardening: **complete**. Every response now carries a
Content-Security-Policy, X-Content-Type-Options, X-Frame-Options,
Referrer-Policy, and Permissions-Policy header (`app/common/
security_headers.py`), plus Strict-Transport-Security when `ENABLE_HSTS`
is on (default in production) and the request is seen as HTTPS. The CSP
needs no `'unsafe-inline'`: the one inline `<script>` (theme pre-paint,
Phase 3) moved to `static/js/theme-init.js`, and the admin CMS's inline
`style="display:inline"`/`onsubmit="confirm(...)"`/`onclick="this.
select()"` attributes were replaced with a small `admin.css` utility
class and an unobtrusive `admin-ui.js`. A `ProxyFix` wrapper (opt-in via
`TRUST_PROXY_HEADERS`/`PROXY_COUNT`, off by default) makes the app see the
real client IP/scheme behind Nginx. `pip-audit` found two vulnerabilities,
both in dev-only tooling (`black`, `pytest`) that never ships in the
production image, with no patch available in the pinned major-version
line - accepted as risk rather than force a major bump mid-hardening-phase
(docs/DECISIONS.md #57). The Dockerfile/docker-compose.yml were hardened
(read-only root filesystem, dropped Linux capabilities,
`no-new-privileges`, a dedicated `media_uploads` volume, a new
`gunicorn.conf.py` with production-sized worker count/timeouts/graceful
reload replacing the old inline CLI flags) and gained a profile-gated
`migrate` one-shot service (documented as the safe migration path once
scaled past one `app` replica; the single-instance default still runs
`flask db upgrade` on boot, which is correct for this app's target
deployment size) and a profile-gated `proxy` (Nginx) service backed by a
new `deploy/nginx/portfolio.conf` example config. `.github/workflows/
ci.yml` gained `dependency-audit` (`pip-audit`) and `docker-build` jobs; a
pre-existing YAML-quoting bug in the `test` job's env block (found while
validating the workflow file with PyYAML) was also fixed. docs/BACKUPS.md
documents (and, for the PostgreSQL half, actually exercises) a
`pg_dump`/`pg_restore` procedure for the database and a `tar`-based
procedure for the local media directory; docs/DEPLOYMENT.md gained
migration-procedure, Nginx, reverse-proxy-trust, and HSTS sections. The
exit criterion ("production checklist passes") is verified by everything
in "Verification performed" below: 428 automated tests (417 existing +
11 new in `tests/test_security_headers.py`) with no regressions,
ruff/black/mypy all clean, `pip-audit` run and its findings documented,
and a live curl-driven check of every header (including HSTS's
proxy-header-gated behavior) plus the full CSRF-protected login and
contact-form flows against a real Gunicorn + PostgreSQL server with the
new middleware active. `docker build`/`docker compose up`/the `proxy`
Nginx service were **not** executed (still no Docker daemon available in
this build session - see "Not verified" below); every Docker/Compose/
Nginx change is config-level and was reviewed manually plus YAML-validated
with PyYAML, consistent with how every prior phase handled this same
constraint.

Phase 9 — Final verification: **complete**. Full suite: 428 automated
tests passing, 91% statement coverage (`pytest --cov=app`); Ruff, Black,
and mypy all report clean across the whole codebase. A from-scratch
migration run (all seven migrations, Phase 0 through Phase 8) applied
cleanly against both a fresh SQLite database (with a full upgrade/
downgrade/re-upgrade round-trip) and a freshly-initialized disposable
PostgreSQL 16 server, with `flask db migrate` reporting "No changes in
schema detected" afterward (no drift) on Postgres. A 41-step, single-pass
curl-driven smoke test against real Gunicorn + that PostgreSQL server
exercised the full user journey end-to-end (admin bootstrap → login →
CSRF-protected profile/experience/project/skill-category/skill creation →
template switching across three themes with content proven unchanged →
blog post creation → not-public-as-draft → publish → sanitized rendering
(script tag stripped, Markdown bold rendered) → RSS/sitemap inclusion →
contact form CSRF/honeypot/rate-limit (429 confirmed) → media upload
content-sniffing (valid PNG accepted, byte-spoofed fake PNG rejected) →
security headers present → every admin route confirmed blocked both
before login and after logout) — all 41 checks passed on the final run
(see "Verification performed" below for the two earlier script-bug-caused
failures that were diagnosed as smoke-test bugs, not application bugs,
and corrected). A security re-review (hardcoded secrets, raw SQL string
interpolation, unsafe/open redirects, missing `@admin_required` on any
admin route, `|safe`/`Markup` usage, `DEBUG` defaults) found no new
issues. `docker build`/`docker compose up` remain **not executed** — no
Docker daemon is available in this environment, exactly as in every prior
phase; this is the one call-out under "Not verified" below that a human
must close out on a Docker-capable machine before real production
deployment. See docs/RELEASE_SUMMARY.md for the full release write-up
(features, architecture, environment variables, commands, deployment
instructions, and an honest requirement-by-requirement gap check against
docs/MASTER_PROMPT.md/docs/PRD.md).

## What exists

### Repository structure
Domain-organized `app/` package per docs/ARCHITECTURE.md's layout:
`auth/`, `admin/`, `public/`, `portfolio/`, `blog/`, `contact/`,
`templates_engine/`, `seo/`, `models/`, `services/`, `repositories/`,
`common/`, plus `templates/` (with `themes/{minimal,modern,cybersecurity,
academic,creative}` placeholders) and `static/{css,js,images}`. All are
currently empty domain packages (just `__init__.py`) — populated starting
Phase 1.

### Application factory
`app/__init__.py` — `create_app(config_object=None)`, no module-level Flask
instance. Registers extensions, structured logging, and the health
blueprint; imports `app.models` so Alembic autogenerate sees all model
metadata once domain models are added.

### Configuration
`app/config.py` — `BaseConfig` / `DevelopmentConfig` / `TestingConfig` /
`ProductionConfig`, selected via `APP_ENV` or an explicit argument. All
values come from environment variables with safe defaults; no secrets are
hard-coded. `ProductionConfig.init_app` raises `RuntimeError` if
`SECRET_KEY` or `DATABASE_URL` are missing. See docs/DECISIONS.md #1, #4.

### Extensions
`app/extensions.py` — `db` (Flask-SQLAlchemy), `migrate` (Flask-Migrate),
`csrf` (Flask-WTF `CSRFProtect`), instantiated outside the factory and
attached inside `create_app`.

### Model base
`app/models/base.py` — dialect-independent UUID primary key (`GUID` type)
and a `TimestampMixin` for UTC-aware `created_at`/`updated_at`, for Phase 1+
domain models to build on. No domain tables defined yet.

### Observability
`app/common/logging.py` — JSON structured logging to stdout, per-request
`request_id` (from `X-Request-ID` or generated) attached to every log line
and echoed in the response header, request start/duration logging.
`app/common/health.py` — `GET /healthz` (liveness, always 200) and
`GET /readyz` (readiness; runs `SELECT 1`, returns 503 on DB failure).

### Migrations
Flask-Migrate/Alembic initialized (`migrations/`). Three committed
migrations: `1279f3ba16bf_foundation_baseline.py` (Phase 0, intentionally a
no-op — see docs/DECISIONS.md #5), `03c629ad4d1e_add_users_table.py`
(Phase 1 — creates the `users` table: UUID PK, unique-indexed `email`,
`password_hash`, `role` with a `CHECK (role IN ('admin'))` constraint,
`is_active`, `last_login_at`, `created_at`/`updated_at`), and
`2f37f4959076_add_portfolio_content_tables.py` (Phase 2 — creates all 11
tables described above: `profiles`, `social_links`, `experiences`,
`educations`, `skill_categories`, `skills`, `projects`,
`project_technologies`, `certifications`, `achievements`, `resumes`, with
their FKs/indexes/unique constraints/check constraint). Both migrate
Phase 2. Autogenerated via `flask db migrate`, then manually fixed to add
the missing `import app.models.base` line — the same one-line
Flask-Migrate `env.py` gap Phase 1 hit, not a design change. Verified
round-trip (`flask db upgrade` then `flask db downgrade`) against SQLite,
and a second `flask db migrate` after applying it produces "No changes in
schema detected" (no drift between the models and the migration).

### Authentication (Phase 1)
- **Model**: `app/models/user.py` — `User(Base, TimestampMixin)`,
  `UserRole` enum (`admin` only for now). `role` is a plain column with a
  DB-level check constraint rather than a normalized `Role` table (see
  docs/DECISIONS.md #12). Implements the Flask-Login user-object contract
  (`is_authenticated`, `is_anonymous`, `get_id()`) plus an `is_admin`
  property (`is_active and role == "admin"`) used by the authorization
  decorator.
- **Password hashing**: `app/services/auth_service.py` wraps
  `argon2.PasswordHasher` (Argon2id) — see docs/DECISIONS.md #11.
  `hash_password`/`verify_password` are the only functions that touch
  argon2 directly; `verify_password` never raises, always returns `bool`.
- **Auth service**: `app/services/auth_service.py` also has `authenticate()`
  (generic failure for unknown-email/wrong-password/inactive-account, plus
  a dummy hash verification on unknown email to reduce timing-based email
  enumeration — docs/DECISIONS.md #16), `record_successful_login()`
  (updates `last_login_at`), and `bootstrap_admin()` (idempotent, see
  below).
- **Routes**: `app/auth/routes.py` (`auth` blueprint, `/auth/login` GET+POST,
  `/auth/logout` POST-only). Login clears the session and calls
  `login_user()` only after successful `authenticate()`
  (session-fixation mitigation, docs/DECISIONS.md #13); logout requires
  `@login_required` and also clears the session. Forms: `app/auth/forms.py`
  (`LoginForm`, a `FlaskForm` — CSRF wired automatically through the
  already-global `CSRFProtect` extension from Phase 0).
- **Authorization**: `app/auth/decorators.py` — `admin_required` composes
  Flask-Login's `login_required` (unauthenticated → redirect to login) with
  a server-side `current_user.is_admin` check (authenticated-but-not-admin
  → `403`). Nothing client-supplied is trusted; re-evaluated on every
  request from the DB-backed `is_active`/`role` columns (verified by test —
  deactivating a user server-side revokes access on the very next request
  even with a still-valid session cookie).
- **Minimal admin route**: `app/admin/routes.py` (`admin` blueprint,
  `GET /admin/`, `@admin_required`) — a bare dashboard page, added
  specifically to give Phase 1's exit criterion ("unauthenticated users
  cannot access admin routes") a concrete route to verify against, per
  docs/IMPLEMENTATION_PLAN.md's allowance for "a minimal protected test
  route". The real admin CMS UI is Phase 2+.
- **Session security**: `app/config.py`'s existing
  `SESSION_COOKIE_HTTPONLY/SECURE/SAMESITE`/`PERMANENT_SESSION_LIFETIME`
  (Phase 0) are now actually exercised. `login_manager.session_protection =
  "strong"` added (logs a session out if its remote-addr/user-agent
  fingerprint changes).
- **CSRF**: no new wiring needed — Phase 0's global `CSRFProtect` extension
  now protects real forms (login, logout). Verified with a dedicated test
  that re-enables `WTF_CSRF_ENABLED` (off by default in `TestingConfig`)
  and confirms a token-less POST to `/auth/login` is rejected with `400`.
- **Rate limiting**: `app/extensions.py` — `limiter = Limiter(key_func=
  get_remote_address)`, using Phase 0's already-anticipated
  `RATELIMIT_STORAGE_URI`/`RATELIMIT_DEFAULT` config keys (`memory://` by
  default — see docs/DECISIONS.md #14). `/auth/login` is decorated with a
  dynamic limit read from the new `LOGIN_RATE_LIMIT` config key (default
  `"5 per minute;20 per hour"`).
- **Bootstrap**: `app/cli.py` — `flask bootstrap-admin` (idempotent; reads
  `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD_HASH` or
  `ADMIN_BOOTSTRAP_PASSWORD`; never overwrites an existing account — see
  docs/DECISIONS.md #15) and `flask hash-password` (prints an Argon2id hash
  for an operator to put in `ADMIN_BOOTSTRAP_PASSWORD_HASH`, prompts via
  `getpass` if no argument given so the plaintext never hits shell
  history). `docker-compose.yml`'s `app` command now runs
  `flask db upgrade && flask bootstrap-admin && gunicorn ...`.
- **Templates**: `app/templates/base/layout.html` (minimal shared layout,
  flash-message rendering), `app/templates/auth/login.html`,
  `app/templates/admin/dashboard.html` — intentionally unstyled/bare; the
  polished UI pass is Phase 3/4 scope, not Phase 1.

### Portfolio content (Phase 2)
- **Models**: `app/models/base.py` gained two mixins used by every child
  entity below: `OrderingMixin` (`display_order: int`, default 0) and
  `VisibilityMixin` (`visible: bool`, default True) — the concrete
  ordering/visibility implementation of CLAUDE.md's "content should support
  ordering and active/inactive visibility where appropriate" rule.
  `Profile` (`app/models/profile.py`, 1:1 with `User` via a unique
  `user_id` FK) owns `SocialLink` (same file), `Experience`
  (`app/models/experience.py`), `Education` (`app/models/education.py`),
  `Project`+`ProjectTechnology` (`app/models/project.py`, `Project.slug`
  unique-indexed), `Certification` (`app/models/certification.py`),
  `Achievement` (`app/models/achievement.py`), and `Resume`
  (`app/models/resume.py`, 1:1 singleton) — all via `ON DELETE CASCADE`
  foreign keys, so deleting a `Profile` cleans up its whole content tree.
  `SkillCategory`+`Skill` (`app/models/skill.py`) are a separate, unscoped
  (no `profile_id`) global taxonomy per docs/DATABASE_DESIGN.md — see
  docs/DECISIONS.md #18. `Skill.proficiency` is an `Integer` 1–5 with a
  `CHECK` constraint (docs/DECISIONS.md #19).
- **Services**: `app/services/portfolio_content.py` is a small generic
  CRUD+reordering engine (`list_scoped`/`get_scoped`/`create_scoped`/
  `update_entity`/`delete_entity`/`reorder_scoped`/`move`) shared by every
  entity above, parametrized by whatever "scope" column(s) a model uses
  (`profile_id`, `category_id`, `project_id`, or none for the global
  `SkillCategory` list). `get_scoped` is the IDOR guard used everywhere:
  fetching by id *and* scope in one query, returning `None` (never raising)
  on a mismatch, so a wrong-owner id and a nonexistent id are
  indistinguishable (404, not a leaking 403). Thin, clearly-named wrapper
  modules (`profile_service.py`, `social_link_service.py`,
  `experience_service.py`, `education_service.py`, `certification_service.py`,
  `achievement_service.py`, `skill_service.py`, `resume_service.py`,
  `project_service.py`) call into this engine so routes/tests import
  obviously-named functions (e.g. `experience_service.create_experience`)
  rather than the generic engine directly. `project_service.py` additionally
  owns slug generation/uniqueness (`slugify`/`unique_slug`) and technology
  list sync (`sync_technologies`, from a single comma-separated form field —
  see docs/DECISIONS.md #20).
- **Admin routes** (`app/admin/routes.py`, all behind the existing
  `admin_required` decorator): `/admin/profile` and `/admin/resume` are
  singleton GET+POST edit pages (auto-creating the row on first visit).
  `/admin/social-links`, `/admin/experience`, `/admin/education`,
  `/admin/certifications`, `/admin/achievements` are registered through one
  generic route factory (`_register_profile_scoped_crud`) that wires up
  list/new/edit/delete/move-up/move-down for a `Profile`-scoped entity from
  a model+form pair, to avoid hand-duplicating six nearly-identical route
  sets. `/admin/projects/*` and `/admin/skill-categories/*`
  (+ nested `/admin/skill-categories/<id>/skills/*`) are hand-written
  because they need extra behavior (slug/technology handling; the
  category→skill nesting) the generic factory doesn't cover. Reordering is
  exposed as "move up"/"move down" POST buttons (keyboard-/screen-reader-
  operable without JavaScript) rather than drag-and-drop — see
  docs/DECISIONS.md #21; `reorder_scoped` (whole-list reorder from an
  explicit id order) exists in the service layer and is covered by tests
  for a future HTMX drag-and-drop UI to call.
- **Forms**: `app/admin/forms.py` — one `FlaskForm` per entity
  (`ProfileForm`, `SocialLinkForm`, `ExperienceForm`, `EducationForm`,
  `SkillCategoryForm`, `SkillForm`, `ProjectForm`, `CertificationForm`,
  `AchievementForm`, `ResumeForm`), CSRF-protected automatically via the
  already-global `CSRFProtect` extension. Field names are deliberately
  chosen to match the target model's column names exactly, so
  `app/admin/routes.py`'s `_form_fields(form)` helper (`dict(form.data)`
  minus `csrf_token`) can be passed straight into the service layer -
  mass-assignment is bounded by the form's declared fields, not by
  arbitrary POST body keys. Field lengths mirror the model column lengths.
  `ExperienceForm` has a custom `validate()` requiring `end_date` unless
  `is_current` is set, and rejecting an `end_date` before `start_date`.
- **Templates**: two generic, intentionally plain templates
  (`app/templates/admin/entity_list.html`, `entity_form.html`) are reused
  by every entity type instead of one bespoke template per entity - the
  form template iterates `for field in form` and renders each field's
  `label`/widget/errors generically (skipping only `CSRFTokenField`), which
  is what keeps every field's `<label for=...>` correctly associated with
  its input without per-form template code. `app/templates/admin/_nav.html`
  is a shared nav landmark (`<nav aria-label="Admin sections">`) included on
  the dashboard and every list/form page.
- **Ordering semantics**: `display_order` values are dense integers
  reassigned on every create (`append to end`) and every move/reorder call;
  nothing depends on absolute values, only relative order, so no
  background renumbering job is needed.

### Template engine (Phase 3)
- **Registry (code, not data)**: `app/templates_engine/registry.py` defines
  a `ThemeDefinition` (key, display name, description, template directory,
  stylesheet filename) for each of the five required built-in themes
  (`minimal`, `modern`, `cybersecurity`, `academic`, `creative`) — this is
  the authoritative list of what themes *exist*; adding a sixth theme is a
  code change (a new entry here + its template/CSS files), never a data-only
  admin action. `registry.DEFAULT_THEME_KEY` (`"minimal"`) gives "no
  template is active yet" a deterministic resolution.
- **Model**: `app/models/portfolio_template.py` — `PortfolioTemplate(Base,
  TimestampMixin)`, table `portfolio_templates` (`key` unique-indexed,
  `name`, `description`, `is_active`). Tracks *which* registered themes
  exist as admin-visible rows and *which one is active* — the only two
  things a code-only registry can't durably store. "Exactly one active"
  is enforced in the service layer (both the deactivate-all and
  activate-target updates happen in one transaction/commit), not a DB
  constraint — see docs/DECISIONS.md #24.
- **Service**: `app/services/template_service.py` — `sync_registry()`
  (idempotently mirrors the registry into the DB, called defensively at the
  top of every other function so the DB is never stale relative to the
  code), `list_templates()`, `get_active_template()`, `set_active_template
  (key)` (raises `UnknownTemplateError` for any key not in the registry —
  "only implemented/valid themes selectable"), and `render_preview(key,
  **context)` (renders `themes/<template_dir>/preview.html` with whatever
  content context is passed in). Nothing in this module ever reads or
  writes a Profile/Experience/Project/etc. row — switching the active
  template is exactly one UPDATE statement on `portfolio_templates`,
  verified directly by `tests/test_template_engine.py`'s
  `TestSwitchingNeverMutatesContent`.
- **Shared content macros**: `app/templates/base/_content_components.html`
  — `portfolio_hero(profile)`, `experience_list(experiences)`,
  `skill_badges(skills)` Jinja macros. Every theme's `preview.html` imports
  and calls the *same* macros with the *same* Profile/Experience objects —
  per CLAUDE.md rule #17 ("Do not duplicate portfolio data for each
  theme"), no theme template ever re-authors a name or list item; only the
  surrounding markup/CSS classes a theme wraps around the macro output
  differ.
- **Shared layout skeleton**: `app/templates/themes/_layout.html` — the one
  html/head/body scaffold all five themes render through (Bootstrap 5 via
  CDN, `base.css`, the active theme's own stylesheet, the dark/light toggle
  button + script, a skip link). Each theme contributes only its own
  `app/templates/themes/<key>/preview.html` (extends `_layout.html`,
  imports the shared macros, adds a thin theme-specific structural wrapper
  — e.g. minimal's terminal-prompt framing, academic's "Curriculum Vitae"/
  "Positions Held" kickers, creative's gradient banner) — not a duplicated
  base layout per theme.
- **Theme CSS**: `app/static/css/base.css` (shared reset + the CSS custom
  properties every theme overrides + light/dark fallback values) and
  `app/static/css/themes/{minimal,modern,cybersecurity,academic,
  creative}.css` (one file per theme, each redefining the same variable set
  under its own `.theme-<key>` selector — a distinct font stack, color
  palette, and a handful of structural rules — giving each theme a
  genuinely distinct visual identity from identical markup/content). Each
  theme file also carries an explicit "opposite mode" override block
  (`html[data-bs-theme="dark"] .theme-<key>` or the `light` equivalent,
  whichever isn't the theme's natural default) so the light/dark toggle
  actually changes each theme's palette rather than only toggling Bootstrap's
  own component chrome.
- **Dark/light mode**: `app/static/js/theme-toggle.js` (vanilla JS, no
  framework) toggles the `data-bs-theme` attribute on `<html>` — the same
  attribute Bootstrap 5 reads natively for its own dark-mode component
  styles — and persists the choice to `localStorage`
  (`"portfolio-color-mode"`). An inline script at the top of
  `themes/_layout.html`'s `<head>` applies the stored value (or
  `prefers-color-scheme` if nothing is stored yet) before first paint, to
  avoid a flash of the wrong mode. See docs/DECISIONS.md #25 for why
  `localStorage` was chosen over a cookie for this phase.
- **Admin routes** (`app/admin/routes.py`, all behind `admin_required`):
  `GET /admin/templates` (list every registered template with its
  active/inactive status), `POST /admin/templates/<key>/activate`
  (switches the active template; an unrecognized key is a 404, the same
  IDOR-guard-style pattern every other admin route in this app uses for a
  bad object reference), `GET /admin/templates/<key>/preview` (renders the
  requested theme with the signed-in admin's own real Profile/Experience
  content — see docs/DECISIONS.md #26 for why "preview" is an admin-only
  route in this phase, not a public one). `app/templates/admin/
  templates_list.html` is a new, small dedicated template (the generic
  `entity_list.html` doesn't fit — templates aren't a scoped/orderable
  CRUD list, they're a fixed registry-backed set with one "set active"
  action); `app/templates/admin/_nav.html` gained a "Templates" link.
- **Migration**: `migrations/versions/eda62625c94d_add_portfolio_templates_
  table.py` (Phase 3 — creates `portfolio_templates`: UUID PK, unique-
  indexed `key`, `name`, `description`, `is_active`, `created_at`/
  `updated_at`). Autogenerated via `flask db migrate`, then manually fixed
  to add the missing `import app.models.base` line — the same one-line
  Flask-Migrate `env.py` gap every prior phase's migration hit.

### Public portfolio (Phase 4)
- **Navigation configuration**: `app/models/navigation.py` -
  `NavigationItem(Base, TimestampMixin, OrderingMixin, VisibilityMixin)`,
  table `navigation_items`. Global/unscoped (same shape as `SkillCategory`
  - one portfolio, one admin). `endpoint` stores a Flask endpoint name
  (e.g. `"public.projects"`), never a raw URL, so a nav entry can only ever
  point at a real, currently-registered public route - resolved through
  `url_for` at render time, never through client- or admin-supplied HTML.
  `app/services/nav_service.py`'s `ALLOWED_NAV_ENDPOINTS` is the code-level
  list of selectable public pages (the "registry defines what's
  selectable, data defines the active/ordered subset" pattern
  `PortfolioTemplate`/`template_service` established in Phase 3);
  `sync_defaults()` seeds the full default set whenever the table is empty
  (fresh install, or an admin who deleted everything and wants the
  defaults back - see docs/DECISIONS.md). Admin CRUD lives at
  `/admin/navigation/*` (list/new/edit/delete/move-up/move-down), reusing
  the same generic `entity_list.html`/`entity_form.html` templates every
  other Phase 2 entity uses, with a `SelectField` restricted to
  `ALLOWED_NAV_ENDPOINTS` so an admin can only choose a real page.
- **Migration**: `migrations/versions/9406e1d86cfe_add_navigation_items_
  table.py`, same `import app.models.base` fix every prior phase's
  autogenerated migration needed. Verified upgrade/downgrade/re-upgrade
  round-trip against SQLite, "no changes detected" on a second
  `flask db migrate`, and applied cleanly against a real PostgreSQL 16
  server (see below).
- **Public blueprint**: `app/public/routes.py` (`public_bp`, no
  `url_prefix` - these are the site root). Ten GET routes: `/`, `/about`,
  `/experience`, `/education`, `/skills`, `/projects`,
  `/projects/<slug>`, `/certifications`, `/achievements`, `/resume`,
  `/contact` - matching docs/API_SPEC.md's public route list (the blog/
  RSS/sitemap/contact-POST routes listed there are Phase 5-7 scope). Every
  route is unauthenticated and read-only. A shared `_page_context()`
  helper resolves the active theme (`template_service.get_active_
  template()`), the single portfolio's `Profile` (`profile_service.
  get_public_profile()` - returns `None`, not an error, before an admin
  has ever visited `/admin/profile`), its `Resume`, and the visible nav
  items, so every route builds on the same base context rather than
  repeating those lookups. `project_service.get_public_project_by_slug()`
  filters on `visible=True` at the query layer (not just in a template),
  so a hidden project's slug 404s even if a client already knows/guesses
  it - not just omitted from listings.
- **Rendering - genuine Phase 3 reuse, not per-theme duplication**: every
  public page is ONE shared Jinja template (`app/templates/public/*.html`,
  ten files) that extends the same `themes/_layout.html` skeleton Phase 3
  built and imports the same `base/_content_components.html` macros -
  there are no per-theme copies of any page. All five themes render
  identically-sourced markup; the active theme's own stylesheet
  (`app/static/css/themes/<key>.css`, unchanged from Phase 3) is what
  makes each theme look different, exactly matching CLAUDE.md rule #17
  ("do not duplicate portfolio data for each theme") and docs/UI_DESIGN.md
  ("do not duplicate domain content"). See docs/DECISIONS.md for why this
  phase chose one shared template per page over five theme-specific page
  variants.
- **Shared layout now serves two modes**: `app/templates/themes/
  _layout.html` gained a `preview_mode` flag. Phase 3's admin-only
  `/admin/templates/<key>/preview` route (`template_service.
  render_preview`) sets it and gets the original "Previewing template"
  banner (no real nav/footer, since preview content may belong to a
  theme that isn't even active); every Phase 4 public page leaves it
  unset and gets the real site chrome - `nav_bar()` and `site_footer()`
  macros, built from the exact same shared-macro pattern. This was a
  deliberate extension of existing Phase 3 infrastructure rather than a
  parallel layout file.
- **New shared macros** (`app/templates/base/_content_components.html`,
  alongside Phase 3's `portfolio_hero`/`experience_list`/`skill_badges`):
  `skill_badge_list`/`skill_categories` (skills grouped by visible
  category), `education_list`, `certification_list`, `achievement_list`,
  `project_card`/`project_grid`, `resume_panel`, `contact_panel` (see
  below), `nav_bar`, `site_footer`. Every macro that lists a collection
  filters `| selectattr("visible")` itself (mirroring Phase 3's
  `experience_list`), so an inactive item never reaches the public HTML
  regardless of which page/theme renders it, and every empty case renders
  a real "No X yet." message (`.empty-state` class) instead of a blank
  section - the "meaningful empty states" requirement.
- **Accessibility**: a skip link (`href="#main-content"`, reused from
  Phase 3's layout) on every page; one semantic `<h1>` per page (the
  hero's on Home/About, a `class="visually-hidden"` heading matching the
  page title on interior list pages so the visible heading stays the
  macro's own `<h2>`, the project title on project-detail); `aria-
  labelledby` on every content section; `aria-current="page"` on the
  active nav link; alt text on the hero portrait and every project-card
  image (`"Portrait of {name}"` / `"Screenshot of {title}"`); labeled
  `<label for=...>` fields on the (disabled, backend-not-wired) contact
  form; a keyboard-operable mobile nav toggle (`app/static/js/
  nav-toggle.js`, progressive enhancement only - the nav list is always
  present, plain markup).
- **Resume delivery**: URL-only, per CLAUDE.md's "for the initial release,
  support image URLs and a storage abstraction" - `GET /resume` renders
  `Resume.public_url` as a "View / download resume" link
  (`target="_blank" rel="noopener noreferrer"`) when `download_enabled`
  is set, or an empty state otherwise. No file upload/serving route exists
  yet (Phase 7 - media/uploads). See docs/DECISIONS.md.
- **Contact page**: a real page reachable from nav, showing
  `Profile.public_email` (a `mailto:` link) when set, plus a visibly
  present but `disabled` HTML contact form (labeled fields, an explanatory
  note pointing at the mailto fallback) - present in markup so a future
  Phase 7 only needs to wire up a `POST` handler and enable the inputs,
  not build the page. No contact backend/route/rate-limiting/email
  adapter was added - that is explicitly Phase 7 scope. See
  docs/DECISIONS.md.
- **Themed 404**: `app/templates/public/404.html`, registered via a plain
  `@app.errorhandler(404)` in `app/__init__.py` (not a blueprint route,
  since Flask error handlers apply app-wide) - looks up the active theme/
  profile/nav the same way every public route does and renders through
  the same shared layout, so an unknown path still looks like the rest of
  the site rather than Flask's default error page.
- **CSS**: `app/static/css/base.css` gained the new shared, theme-neutral
  structural rules every theme's page needs (header/nav/mobile-toggle,
  footer, project grid/card, education/certification/achievement list,
  contact-form field styling, `:focus-visible` outline) - still carrying
  no visual identity of its own beyond the CSS custom properties every
  `app/static/css/themes/<key>.css` file already overrode in Phase 3, so
  every theme automatically gets a themed header/footer/grid without any
  theme-specific CSS file needing a Phase 4 change.

### Blog CMS (Phase 5)
- **Models**: `app/models/blog.py` — `BlogCategory` (`Base`, `TimestampMixin`;
  unique `name`/`slug`, optional `description`), `BlogTag` (same shape,
  unique `name`/`slug`), `BlogPost` (`Base`, `TimestampMixin`; `title`,
  unique-indexed `slug`, `excerpt`, `markdown_body`, `rendered_body`
  (sanitized HTML, populated at save time - see below), `cover_image_url`,
  `category_id` FK (`ON DELETE SET NULL`), `status` (`draft`/`published`/
  `scheduled`, `String` + `CHECK` constraint - the same convention
  `User.role` established in Phase 1, docs/DECISIONS.md #12), `featured`,
  `published_at`/`scheduled_at` (both indexed, both nullable), `seo_title`,
  `seo_description`, `canonical_url`, `author_id` FK to `users.id`
  (`ON DELETE SET NULL` - deleting the author never deletes their posts),
  and a `tags` many-to-many via the `blog_post_tags` association table
  (composite primary key `(post_id, tag_id)` - itself the "unique(post_id,
  tag_id)" constraint docs/DATABASE_DESIGN.md asks for, `ON DELETE CASCADE`
  both directions). `BlogPost.is_publicly_visible(now)` is the single source
  of truth for public visibility - see "Scheduling abstraction" below.
- **Markdown + sanitization**: `app/services/markdown_service.py` -
  `render_markdown()` renders Markdown (the `markdown` library, with
  `codehilite`/`fenced_code`/`tables` extensions for Pygments-backed syntax
  highlighting) then always passes the result through `bleach.clean()`
  against an explicit tag/attribute/URL-protocol allowlist before returning
  it - this is the only function anywhere in this codebase allowed to turn
  Markdown into HTML, and CLAUDE.md rule #14 ("Sanitize rendered blog HTML")
  is satisfied by construction: there is no code path that renders
  `markdown_body` (or any Markdown text) directly as `| safe` HTML. See
  docs/DECISIONS.md for the library choice and the sanitize-on-save
  decision.
- **Sanitize-on-save**: `app/services/blog_service.py`'s `_apply_fields()`
  calls `render_markdown()` once per create/update and stores the result in
  `BlogPost.rendered_body` (matching docs/DATABASE_DESIGN.md's
  "rendered_body optional/cacheable" hint) - every public/admin-preview
  request renders a plain, already-sanitized HTML string with zero
  per-request Markdown/sanitization cost. The admin edit/new form's preview
  pane and the full-page admin preview route both call
  `blog_service.preview_html()` (the same `render_markdown()` function)
  against not-yet-saved form input, so what an admin previews is exactly
  what will be saved.
- **Scheduling abstraction**: there is no background job/worker/cron that
  "runs" a schedule. `BlogPost.is_publicly_visible(now)` computes visibility
  purely from `status` + `effective_publish_at()` (`published_at`, falling
  back to `scheduled_at`) compared against `now` - a post scheduled for a
  past timestamp is immediately public the next time anything queries it; a
  post scheduled for the future stays hidden until that moment passes on a
  later request. `app/services/blog_service.py`'s public query functions
  (`list_public_posts`/`get_public_post_by_slug`/
  `list_public_posts_by_category`/`list_public_posts_by_tag`) all apply this
  same rule at the SQL/query layer (never a Python-side filter after
  over-fetching), mirroring `project_service.get_public_project_by_slug`'s
  Phase 4 "filter at the query layer" precedent - a draft or not-yet-
  scheduled post's row is never returned to a public route. See
  docs/DECISIONS.md for the full write-up and alternatives considered.
- **Publish/unpublish/schedule as explicit actions, not form fields**:
  `BlogPostForm` deliberately has no `status`/`published_at`/`scheduled_at`
  fields - a plain "Save" can never accidentally publish, unpublish, or
  reschedule a post. `blog_service.publish_post()` (stamps `published_at`
  only if unset - republishing never bumps the date),
  `blog_service.unpublish_post()` (returns to `draft`, leaves `published_at`
  as an audit trail), and `blog_service.schedule_post()` (sets `scheduled_at`
  and clears `published_at`) are separate service functions, each exposed as
  its own dedicated admin POST route.
- **Services**: `app/services/blog_service.py` (post CRUD, slug generation/
  uniqueness via the same `slugify`/`unique_slug` pattern
  `project_service.py` established, publish/unpublish/schedule, the public
  visibility-filtered queries above), `app/services/blog_category_service.py`
  and `app/services/blog_tag_service.py` (CRUD + slugging for the two small
  global taxonomies - neither has `OrderingMixin`/`VisibilityMixin` per
  docs/DATABASE_DESIGN.md, so neither goes through
  `app/services/portfolio_content.py`'s generic engine, which assumes both).
  Tags are authored on the post form as one comma-separated field
  (`"flask, security"`), resolved/created via `blog_tag_service.
  get_or_create_tag`/`assign_tags` - the same "single text field replaces a
  list wholesale" pattern `project_service.sync_technologies` established
  for `ProjectTechnology` in Phase 2, except tags are a real many-to-many
  (shared across posts), so "replace wholesale" only ever changes one post's
  association, never deletes a tag another post still uses.
- **Admin routes** (`app/admin/routes.py`, all behind `admin_required`):
  `/admin/blog` (list, with a `?status=` filter), `/admin/blog/new` and
  `/admin/blog/<id>/edit` (Markdown textarea + a sanitized rendered-HTML
  preview pane that re-renders on every submit, even one that fails
  validation), `/admin/blog/<id>/delete`, `/admin/blog/<id>/publish`,
  `/admin/blog/<id>/unpublish`, `/admin/blog/<id>/schedule` (a small
  dedicated form taking a UTC datetime), `/admin/blog/<id>/preview` (a
  full-page preview reusing the same rendered HTML, reachable for a draft an
  admin wants to review before publishing), and full CRUD for
  `/admin/blog/categories/*` and `/admin/blog/tags/*`. Every id lookup uses
  the same "fetch by id, 404 on no match" IDOR-guard pattern as every other
  admin route in this app.
- **Forms**: `app/admin/forms.py` gained `BlogPostForm` (title, slug,
  excerpt, `markdown_body`, `cover_image_url`, a `category_id` `SelectField`
  populated at construction time from `blog_category_service.
  list_categories()`, `tags`, `featured`, `seo_title`, `seo_description`,
  `canonical_url` - no status/timestamp fields, see above),
  `BlogCategoryForm`, `BlogTagForm`, and `BlogScheduleForm` (a single
  `scheduled_at` `DateTimeField`).
- **Templates**: `app/templates/admin/blog_list.html` (status-filter nav +
  per-row publish/unpublish/schedule/delete actions), `blog_form.html`
  (extends the generic field-loop pattern `entity_form.html` established,
  plus the sanitized preview pane), `blog_preview.html` (full-page preview),
  `blog_taxonomy_list.html` (a small dedicated list template for categories/
  tags, since neither has the `visible`/move-up/move-down columns
  `entity_list.html` assumes). Public: `app/templates/public/blog_list.html`
  and `blog_detail.html` extend the same `themes/_layout.html` skeleton and
  import the same `base/_content_components.html` macros every other public
  page uses - no theme-specific duplication. New shared macros in
  `_content_components.html`: `blog_post_card`, `blog_post_list`,
  `blog_post_meta` (date/category/tags/featured badge). `themes/
  _layout.html` and `base/layout.html` both gained a `{% block extra_head
  %}` (plus a `canonical_url`-driven `<link rel="canonical">`) so blog pages
  can add their own stylesheet/OpenGraph tags without a parallel layout
  file.
- **CSS**: `app/static/css/blog.css` (theme-neutral structural rules for the
  post grid/cards/tag chips/body typography, following the same "colors
  come from theme CSS custom properties" pattern `base.css` already uses)
  and `app/static/css/pygments.css` (generated once via
  `pygments.formatters.HtmlFormatter().get_style_defs('.codehilite')` for
  syntax-highlighted code blocks), both loaded only on blog pages via the
  new `extra_head` block rather than unconditionally on every page.
- **Navigation**: `app/services/nav_service.ALLOWED_NAV_ENDPOINTS` gained
  `("public.blog_home", "Blog")` - a fresh install's seeded default nav now
  includes a Blog link; an existing install's already-seeded nav is
  unaffected (an admin can add it manually via `/admin/navigation/new`),
  consistent with `sync_defaults()`'s existing "empty means (re)seed the
  defaults" behavior (docs/DECISIONS.md #28).
- **Migration**: `migrations/versions/1a4a26642c93_add_blog_cms_tables.py` -
  creates `blog_categories`, `blog_tags`, `blog_posts`, `blog_post_tags`,
  with all FKs/indexes/unique constraints/the status `CHECK` constraint.
  Autogenerated via `flask db migrate`, then manually fixed to add the
  missing `import app.models.base` line - the same one-line Flask-Migrate
  `env.py` gap every prior phase's migration hit.

### Contact and media (Phase 7)
- **Models**: `app/models/contact_message.py` — `ContactMessage(Base,
  TimestampMixin)`, table `contact_messages`, per docs/DATABASE_DESIGN.md's
  `ContactMessage` list (`name`/`email`/`subject`/`message`/`status`/
  `processed_at`, plus `created_at`/`updated_at` from `TimestampMixin`), with
  `status` following the same "plain column + CHECK constraint" convention
  `User.role`/`BlogPost.status` already established
  (`new`/`read`/`archived`). `ip_address` (nullable, admin-only, never
  rendered publicly) is an addition beyond the DATABASE_DESIGN.md list, for
  the admin's own spam-triage reference, per the Phase 7 task's explicit
  allowance for "IP or similar". `app/models/media_asset.py` —
  `MediaAsset(Base, TimestampMixin)`, table `media_assets`
  (`original_filename`/`stored_name` (unique)/`content_type`/`size_bytes`/
  `uploaded_by_id` FK to `users.id`, `ON DELETE SET NULL` matching
  `BlogPost.author_id`'s precedent) — an audit trail of what has been
  uploaded, independent of which `StorageAdapter` is configured.
- **Email adapter**: `app/common/email.py` — `EmailAdapter` ABC,
  `ConsoleEmailAdapter` (default, `MAIL_PROVIDER=console`; logs via the
  app's structured logger instead of sending — safe for a self-hosted
  install with no SMTP configured), `SMTPEmailAdapter`
  (`MAIL_PROVIDER=smtp`; sends via `smtplib` using
  `MAIL_SMTP_HOST`/`PORT`/`USERNAME`/`PASSWORD`/`USE_TLS`/
  `MAIL_DEFAULT_SENDER`, all environment-variable configured, never
  hard-coded). `get_email_adapter()` is the only factory call site; if
  `MAIL_PROVIDER=smtp` but no host is configured it falls back to the
  console adapter with a warning log rather than raising. See
  docs/DECISIONS.md.
- **Storage adapter**: `app/common/storage.py` — `StorageAdapter` ABC
  (`save`/`open_bytes`/`delete`/`path_for`), `LocalStorageAdapter` (default,
  `STORAGE_PROVIDER=local`; writes under `STORAGE_LOCAL_DIRECTORY`, default
  `instance/uploads`) generating its own randomized `<uuid4-hex>.<ext>`
  filenames (never derived from client input) and rejecting any reference
  that doesn't match that exact shape or that resolves outside the storage
  directory (`InvalidStorageReferenceError`) before ever touching the
  filesystem — the path-traversal guard. Saved files are chmod'd `0o640`
  (no execute bit). `get_storage_adapter()` is the only factory call site;
  adding an S3-compatible backend later is a new class + a new branch there,
  no caller change. See docs/DECISIONS.md.
- **Media service**: `app/services/media_service.py` — `sniff_image()`
  identifies PNG/JPEG/GIF/WebP by actual byte-signature (magic numbers),
  never by the client-supplied filename or `Content-Type` header (both are
  attacker-controlled); `validate_and_save_upload()` enforces the size limit
  (`MEDIA_MAX_UPLOAD_BYTES`, default 5 MB) and the content-sniffed
  image-type allowlist, then delegates the actual bytes to the configured
  `StorageAdapter` and records a `MediaAsset` row.
- **Contact service**: `app/services/contact_service.py` —
  `create_message()` is the single write path (always persists, regardless
  of mail configuration); `notify_new_message()` makes a best-effort
  attempt to email `CONTACT_NOTIFY_EMAIL` via the configured adapter,
  catching and logging any exception rather than letting a broken mail
  setup break the contact flow; `list_messages`/`get_message`/
  `mark_status`/`delete_message` back the admin triage UI.
- **Public route**: `app/public/routes.py`'s `contact()` now handles both
  GET and POST at `/contact` (previously GET-only with an inert form),
  decorated with `@limiter.limit(lambda: current_app.config.get
  ("CONTACT_RATE_LIMIT", ...))` — the exact same pattern
  `app/auth/routes.py`'s login route established in Phase 1
  (docs/DECISIONS.md #14). `app/public/forms.py`'s `ContactForm`
  (`FlaskForm` — automatic CSRF) validates `name`/`email`/`subject`/
  `message` server-side (required fields, `Email()` format check, length
  limits) and carries an undocumented `website` honeypot field; a filled
  honeypot silently drops the submission (no DB write, no email) while
  still rendering the same "thanks" response a genuine visitor would see,
  so a bot gets no signal about which field tipped it off. A second new
  public route, `GET /media/<stored_name>`, serves an uploaded image back
  (no auth required to *view*, matching every other `*_url`-style public
  asset already in this app) with the same traversal-proof `path_for()`
  lookup the storage adapter uses.
- **Contact template**: `app/templates/base/_content_components.html`'s
  `contact_panel(profile, form, submitted)` macro was rewritten from the
  Phase 4 disabled-inputs placeholder into a real, labeled, CSRF-protected,
  server-validated form (inline field errors, a visually-hidden-but-still-
  present-to-naive-bots honeypot field via CSS clipping rather than
  `display:none`, and a "Thanks — your message has been sent" success
  state) — `app/templates/public/contact.html` now passes `form`/
  `submitted` through. `app/static/css/base.css` gained `.form-error`/
  `.form-success`/`.contact-honeypot` rules.
- **Admin routes** (`app/admin/routes.py`, all behind `admin_required`):
  `/admin/messages` (list, `?status=` filter), `/admin/messages/<id>`
  (detail — viewing a `new` message auto-marks it `read`),
  `/admin/messages/<id>/status` (POST, `read`/`archived`),
  `/admin/messages/<id>/delete`; `/admin/media` (GET+POST — upload form +
  list of previously uploaded images, each row showing its public URL to
  copy into any `*_url` field), `/admin/media/<id>/delete`. Every id lookup
  uses the same "fetch by id, `None` → 404" pattern every other admin route
  in this app uses. New templates: `app/templates/admin/messages_list.html`,
  `message_detail.html`, `media_list.html`; `_nav.html` gained "Messages"
  and "Media" links.
- **Forms**: `app/admin/forms.py` gained `MediaUploadForm` (a single
  `FileField` with `FileRequired`/`FileAllowed` — a cheap first filter on
  the client-supplied extension; the real security check is
  `media_service`'s content-sniffing, not this validator).
- **Media integration point**: uploads are a general-purpose endpoint (an
  admin uploads an image, gets back its public URL, pastes it into whatever
  `*_url` field they want — blog cover image, project image, profile photo,
  resume) rather than wired directly into any single existing form field.
  See docs/DECISIONS.md for why this was the least invasive choice given
  the existing Phase 2/5 forms already accept a plain URL string.
- **Configuration**: `app/config.py` gained `MEDIA_MAX_UPLOAD_BYTES`,
  `CONTACT_NOTIFY_EMAIL`, `CONTACT_RATE_LIMIT` (the `MAIL_*`/`STORAGE_*`
  keys already existed since Phase 0, anticipating this phase).
  `.env.example` documents all of them.
- **Migration**: `migrations/versions/2cc96082b855_add_contact_messages_and_
  media_assets_tables.py` — creates `contact_messages` (with its `status`
  CHECK constraint and `email`/`status` indexes) and `media_assets` (with
  its unique `stored_name` index and `uploaded_by_id` FK). Autogenerated via
  `flask db migrate`, then manually fixed to add the missing
  `import app.models.base` line — the same one-line Flask-Migrate `env.py`
  gap every prior phase's migration hit. Verified upgrade/downgrade/
  re-upgrade round-trip against SQLite, "no changes detected" on a second
  `flask db migrate`, and applied cleanly against a real PostgreSQL 16
  server (see below).

### Docker / Compose
`Dockerfile` — multi-stage, `python:3.12-slim` base, non-root `app` user,
Gunicorn entrypoint, `HEALTHCHECK` against `/healthz`.
`docker-compose.yml` — `db` (postgres:16-alpine with healthcheck) + `app`
(builds from Dockerfile, runs `flask db upgrade` then Gunicorn, requires
`SECRET_KEY`). `.dockerignore` excludes dev-only files from the build
context.

### Environment configuration
`.env.example` documents every variable read by `app/config.py`, grouped by
concern (core, database, session, admin bootstrap, mail, storage, rate
limiting, Compose-only Postgres credentials). `.env` itself is gitignored.

### Tests
`tests/conftest.py` — `app`/`client` fixtures using `TestingConfig`
(in-memory SQLite, CSRF disabled by default), so the suite has no external
service dependency; also resets the (process-wide, in-memory) rate limiter
storage before each test, an `admin_user` fixture that persists one active
admin with a known plaintext password, and (new in Phase 2) an
`admin_client` fixture that logs `admin_user` in and hands back the same
test client, for the many Phase 2 route tests that need an authenticated
session. 95 tests total (47 from Phases 0–1, 48 new in Phase 2):
- `tests/test_health.py` (3): healthz, readyz, request-id header.
- `tests/test_app_factory.py` (7): config resolution, factory behavior,
  route registration, production config guards.
- `tests/test_auth_service.py` (16): password hashing (Argon2id, salted,
  round-trips, rejects malformed hash), `authenticate()` success/failure/
  case-insensitivity/inactive-account/empty-input, `bootstrap_admin()`
  skip/create-from-plaintext/create-from-hash/idempotent-no-overwrite.
- `tests/test_auth_routes.py` (9): login page renders, success redirects
  and establishes a session, failure re-renders with a generic error and
  does not authenticate, already-authenticated redirect, logout requires
  auth and actually ends the session.
- `tests/test_authorization.py` (6): unauthenticated → redirect to login
  (no content leak), authenticated admin → 200, **deactivating a user
  server-side revokes access on the very next request** (the core
  don't-trust-client-state check), `is_admin` property correctness.
- `tests/test_csrf.py` (2): CSRF-enabled app fixture — token-less login
  POST → 400, valid-token POST proceeds normally.
- `tests/test_rate_limit.py` (2): exceeding `LOGIN_RATE_LIMIT` → 429;
  fresh window isn't pre-blocked.
- `tests/test_bootstrap_cli.py` (3): `flask bootstrap-admin` creates an
  account, is idempotent (second run doesn't duplicate/overwrite),
  `flask hash-password` prints a valid Argon2id hash.
- `tests/test_portfolio_models.py` (18): model-level constraint/relationship
  tests — `Profile.user_id`/`Project.slug`/`Resume.profile_id`/
  `SkillCategory.name` uniqueness, `Skill.proficiency`'s 1–5 CHECK
  constraint (both a rejected out-of-range value and an accepted boundary
  value), required-field NOT NULL constraints (`Experience.start_date`,
  `Certification.issuer`), `OrderingMixin`/`VisibilityMixin` defaults, and
  `ON DELETE CASCADE` behavior for `Profile`→children, `SkillCategory`→
  `Skill`, and `Project`→`ProjectTechnology`.
- `tests/test_portfolio_services.py` (16): service-layer CRUD +
  reordering — `profile_service.get_or_create_profile` idempotency,
  create/list/update/delete through `social_link_service`, append-to-end
  ordering on create, the `get_*` IDOR guard (fetching under the wrong
  profile/category returns `None`), `move()` up/down including boundary
  no-ops, `reorder_scoped()` applying an explicit order and rejecting a
  mismatched id set, `project_service` slug generation/disambiguation and
  technology-list sync, and `resume_service.upsert_resume`'s
  create-then-update behavior.
- `tests/test_admin_portfolio_routes.py` (14): route-level tests through
  real HTTP requests — unauthenticated requests to every new route family
  are redirected/blocked (and don't create data), the full
  create→edit→delete cycle and move-up reordering for `SocialLink` via
  POST, IDOR checks (editing/deleting a nonexistent/wrong-owner id returns
  404), Project creation generating a slug and syncing its technology list,
  Skill Category→Skill nesting (including a skill fetched under the wrong
  category being 404), the Resume singleton's get-or-none-then-create flow,
  and server-side validation rejection (blank required fields, a malformed
  URL) leaving the database unchanged.
- `tests/test_template_engine.py` (23) and `tests/test_admin_template_routes.py`
  (10) — Phase 3 template engine: all five required themes are registered
  and no others; `set_active_template()`/the activate route reject an
  unregistered key (`UnknownTemplateError` / `404`) without changing the
  active template; exactly one `PortfolioTemplate` row is active at a time;
  every one of the five themes renders without error given sample content
  and each contains its own `theme-<key>` marker; the admin routes'
  authorization (unauthenticated → redirect to login on list/preview,
  activate changes nothing) and the preview route rendering the signed-in
  admin's own profile. **The exit criterion itself**
  (`TestSwitchingNeverMutatesContent`): renders the same Profile/Experience
  content under `minimal` and `creative`, asserts the DB rows (including
  `display_order`) are byte-identical before/after switching the active
  template three times, and asserts the two themes' rendered HTML strings
  are different from each other while both contain the same profile/
  experience data.
- `tests/test_public_routes.py` (43) and `tests/test_nav_service.py` (10) -
  Phase 4 public portfolio: every one of the ten public GET routes returns
  200 with zero content configured (meaningful empty states) and with a
  fully seeded profile (visible experience/education/projects/skills/
  certifications/achievements/resume/social links, plus one deliberately
  hidden `Experience` and one hidden `Project`); the hidden items never
  appear in the rendered HTML while their visible siblings do; an extra,
  earlier-`display_order` experience renders before a later one (ordering
  is respected); `/projects/<slug>` 200s for a visible project, 404s for a
  hidden project's slug (not just omitted from listings - unreachable even
  if guessed) and for an unknown slug; an unknown path renders the themed
  404 page; every one of the five themes renders every one of the ten
  pages without error and contains that theme's `theme-<key>` marker
  (`TestThemingAcrossPublicPages`, parametrized 5 themes x 10 pages); two
  different active themes produce different rendered HTML for identical
  seeded content; navigation reflects admin configuration (default items
  seeded and shown, a hidden nav item disappears from the rendered header,
  a reordered item moves in the rendered `<nav>`); accessibility spot
  checks (skip link present, hero/project-card images carry descriptive
  `alt` text, contact-form inputs have associated `<label for=...>`, the
  `<main id="main-content">` landmark and exactly one page heading are
  present). `test_nav_service.py` covers `sync_defaults()`'s idempotency/
  reseed behavior directly, `is_allowed_endpoint()`, and the
  `/admin/navigation/*` CRUD routes (auth redirect, full create/edit/
  delete cycle, move-up reordering, an unknown id 404ing - the same IDOR-
  guard pattern every other admin route in this app uses).
- `tests/test_markdown_service.py` (10) - Phase 5 sanitization, tested by
  actually attempting XSS payloads and asserting they're neutralized:
  `<script>` tags, `onerror`/other event-handler attributes, `javascript:`
  and `data:` URL schemes, and `<iframe>`/`<style>` tags are all stripped;
  a safe `https://` link/image and Markdown formatting (headings, bold,
  fenced code with `codehilite` syntax-highlighting markup) render
  correctly; empty/`None` input returns an empty string rather than raising.
- `tests/test_blog_models.py` (10) - constraint tests (`BlogPost.slug`/
  `BlogCategory.name`+`slug`/`BlogTag.name` uniqueness, the `status` `CHECK`
  constraint rejecting an invalid value, deleting a `BlogCategory` setting
  dependent posts' `category_id` to `NULL` rather than deleting them) and
  `BlogPost.is_publicly_visible()` visibility-logic tests covering every
  combination: draft (never visible regardless of timestamps), published
  with a past `published_at` (visible), scheduled with a future
  `scheduled_at` (not visible), **scheduled with a past `scheduled_at`
  (visible - the scheduling-abstraction proof)**, and a post with no
  timestamp at all (not visible).
- `tests/test_blog_services.py` (25) - slug generation/disambiguation,
  Markdown-to-`rendered_body` rendering on both create and edit (including
  that a `<script>` tag in the body never reaches `rendered_body`),
  publish/unpublish/schedule state transitions (republishing doesn't move
  `published_at` forward, unpublishing returns to draft and hides the post,
  a future schedule is not public, a past schedule is public "without any
  worker"), category/tag CRUD + slug disambiguation, tag assignment/
  reassignment (`assign_tags` replaces wholesale) and that deleting a tag
  shared by multiple posts only removes the association, the featured flag,
  and the public query functions (`list_public_posts` excludes drafts and
  future schedules, `get_public_post_by_slug` returns `None` for a draft or
  unknown slug and the post for a published one, category/tag filtering).
- `tests/test_admin_blog_routes.py` (15) - route-level: unauthenticated
  requests to every `/admin/blog/*` route are redirected/blocked and create
  no data; the full create->edit->delete cycle through real HTTP POSTs
  (including tag assignment from the comma-separated field); an unknown
  post/category id 404s; publish->unpublish and schedule work through their
  dedicated routes; the full-page preview route renders a draft's rendered
  HTML; a form re-render (after a validation error) still shows a
  sanitized preview pane, never the raw payload; category/tag CRUD through
  the admin UI; the featured checkbox persists.
- `tests/test_public_blog_routes.py` (16) - the exit criteria end to end at
  the HTTP level: an empty blog renders a meaningful empty state; a draft
  post appears on neither the list nor is reachable at its own slug (404,
  not just omitted); a published post appears on the list and its detail
  page renders sanitized HTML (an XSS payload's `<script>` tag never
  survives) with SEO title/description and a `rel="canonical"` link present
  when set (falling back to the post's own title/excerpt when unset); a
  future-scheduled post is hidden from both the list and its detail page
  (404); **a past-scheduled post is public on both** - the scheduling
  abstraction proven through real requests; category and tag pages list
  only their own matching public posts and 404 for an unknown slug; the
  featured flag is reflected in rendered output; every blog page renders
  under all five themes with that theme's `theme-<key>` marker present.
- `tests/test_contact.py` (8) - form rendering, valid submission persisted
  with the correct fields/status/IP, missing-required-field/invalid-email/
  oversized-message rejections leave the database unchanged, a filled
  honeypot silently drops the submission (no row created) while still
  looking like success, and no SMTP credential ever leaks into the
  response when mail is unconfigured.
- `tests/test_contact_csrf.py` (2) - the same CSRF-enabled-app pattern
  tests/test_csrf.py established for login, applied to `POST /contact`: a
  token-less POST is rejected (400), a valid-token POST proceeds.
- `tests/test_contact_rate_limit.py` (2) - the same pattern
  tests/test_rate_limit.py established for login, applied to
  `CONTACT_RATE_LIMIT`/`POST /contact`.
- `tests/test_email_adapter.py` (7) - `ConsoleEmailAdapter` never raises and
  reports success without sending; `get_email_adapter()`'s
  console/smtp selection and its fallback-to-console when `MAIL_SMTP_HOST`
  is unset; `SMTPEmailAdapter` skips gracefully with no sender configured;
  a mocked `smtplib.SMTP` proves the adapter constructs the correct
  From/To/Subject/Reply-To/body and calls `starttls()`/`login()` only when
  configured to (no real network).
- `tests/test_storage_adapter.py` (9) - `LocalStorageAdapter.save()`
  produces a randomized-name file with correct content, two saves never
  collide, saved files carry no execute bit, `delete()` works (including a
  no-op on an already-missing file), and `path_for()`/`open_bytes()` reject
  every attempted path-traversal/malformed-reference shape tried
  (`../../etc/passwd`, URL-encoded traversal, an absolute path, an embedded
  separator, a wrong-length name).
- `tests/test_media_service.py` (11) - `sniff_image()` correctly identifies
  real PNG/JPEG/GIF/WebP byte signatures and rejects non-image content
  (including HTML/script content masquerading with an image filename);
  `validate_and_save_upload()` accepts a real PNG end-to-end (persists a
  `MediaAsset`, storage round-trips the exact bytes), rejects an oversized
  file, rejects disallowed/spoofed content, rejects an empty file, and
  never uses the client-supplied filename as any part of the storage name
  (proven with a `../../../etc/passwd.png`-shaped filename).
- `tests/test_admin_contact_routes.py` (11) - unauthenticated requests to
  every `/admin/messages/*` route are redirected/blocked and change no
  data; an unknown id 404s; the list/detail/status-change/delete cycle
  works through real HTTP requests; viewing a `new` message's detail page
  auto-marks it `read`; an invalid status value is rejected (400); the
  `?status=` filter narrows the list correctly.
- `tests/test_admin_media_routes.py` (11) - unauthenticated upload/delete
  requests are blocked and create nothing; a valid image upload is
  persisted and served back byte-identical at its public URL; an oversized
  upload, content that fails MIME sniffing, and a disallowed extension are
  each rejected without creating a `MediaAsset`; the serving route 404s for
  both a path-traversal-shaped request and an unknown-but-well-formed
  filename; deleting an asset removes both the DB row and the file (a
  subsequent request for its old URL 404s).

### Quality tooling
`pyproject.toml` configures Ruff (`select = E,F,W,I,B,UP,C4,SIM`, line
length 100, `migrations/` excluded) and Black (line length 100,
`migrations/` excluded) and mypy (`ignore_missing_imports`, `migrations`
excluded).

### CI
`.github/workflows/ci.yml` — two jobs: `lint` (ruff, black --check, mypy)
and `test` (spins up a real `postgres:16-alpine` service, runs `flask db
upgrade` against it, then `pytest --cov=app`).

## Verification performed

### Phase 0 session

All commands below were actually executed, not assumed:

| Check | Result |
|---|---|
| `uv pip install -e ".[dev]"` | 38 packages installed cleanly |
| `pytest -q` | **10 passed** |
| `ruff check .` | **All checks passed** |
| `black --check .` | **All done, 23 files unchanged** |
| `mypy app` | **Success: no issues found in 18 source files** |
| `flask db init` / `flask db revision` | migration chain created |
| `flask db upgrade` against SQLite | succeeded |
| `flask db upgrade` against a real PostgreSQL 16 server | succeeded (see below) |
| App via Gunicorn against real PostgreSQL, `curl /healthz` | `200 {"status": "ok"}` |
| App via Gunicorn against real PostgreSQL, `curl /readyz` | `200 {"status": "ready"}` |
| `docker-compose.yml` parses as valid YAML | confirmed |

### Phase 1 session

All commands below were actually executed against this repository, using
`uv venv` + `uv pip install -e ".[dev]"` (same tool Phase 0 used; plain
`pip`/`venv` are not available in this sandbox):

| Check | Result |
|---|---|
| `uv pip install -e ".[dev]"` | 51 packages installed cleanly (adds `flask-login`, `flask-limiter`, `argon2-cffi` and their transitive deps) |
| `pytest -q` | **47 passed** |
| `ruff check .` | **All checks passed** |
| `black --check .` | **All done, 36 files unchanged** |
| `mypy app` | **Success: no issues found in 25 source files** |
| `flask db migrate` (autogenerate) | detected `users` table + unique index correctly; the generated file needed one manual fix (missing `import app.models.base` for the custom `GUID` type — a known gap in Flask-Migrate's default `env.py` template, not specific to this schema) |
| `flask db upgrade` against SQLite (fresh file) | succeeded, both migrations applied in order |
| `flask db upgrade` against a real, disposable PostgreSQL 16 server | succeeded; `\d users` confirmed all columns, the unique index on `email`, and the `CHECK (role IN ('admin'))` constraint landed correctly |
| `flask bootstrap-admin` run twice against that Postgres | first run: `Created administrator account: admin@example.com`; second run: `Administrator account ... already exists; no changes made.` (idempotency confirmed) |
| App under real Gunicorn against that Postgres, full curl-driven flow | see below |

**End-to-end curl flow** (real Gunicorn + real PostgreSQL, cookie-jar-based,
not the Flask test client):
1. `GET /admin/` unauthenticated → `302` to `/auth/login?next=%2Fadmin%2F`.
2. `GET /auth/login` → CSRF token extracted from the rendered form.
3. `POST /auth/login` with wrong password + valid CSRF token → `200`
   (re-rendered form with error, no redirect — not authenticated).
4. `POST /auth/login` with correct password + valid CSRF token → `302` to
   `/admin/`.
5. `GET /admin/` with the resulting session cookie → `200`, page contains
   `Signed in as admin@example.com`.
6. `POST /auth/logout` **without** a CSRF token → `400` (proves
   `CSRFProtect` is actually enforced on a live server, not just present).
7. `POST /auth/logout` **with** a valid CSRF token (fresh token pulled from
   the dashboard page) → `302` to `/auth/login`.
8. `GET /admin/` with the now-logged-out session cookie → `302` back to
   login (access actually revoked, not just a client-side redirect).

### Phase 2 session

All commands below were actually executed against this repository, reusing
the same `uv venv` + `uv pip install -e ".[dev]"` toolchain as Phases 0–1:

| Check | Result |
|---|---|
| `uv pip install -e ".[dev]"` | 65 packages installed cleanly (no new runtime dependencies were needed for Phase 2) |
| `pytest -q` | **95 passed** (47 pre-existing + 48 new) |
| `ruff check .` | **All checks passed** |
| `black --check .` | **All done, 58 files unchanged** |
| `mypy app` | **Success: no issues found in 44 source files** |
| `flask db migrate` (autogenerate) | detected all 11 new tables + their indexes/constraints correctly; needed the same one-line `import app.models.base` fix Phase 1 hit |
| `flask db upgrade` against SQLite (fresh file) | succeeded, all three migrations applied in order |
| `flask db downgrade` (Phase 2 migration only) against that same SQLite file | succeeded, dropped exactly the 11 Phase 2 tables, left `users`/`alembic_version` intact; re-`upgrade` succeeded again |
| A second `flask db migrate` after upgrading | **"No changes in schema detected"** — the migration matches the models exactly, no drift |
| `flask db upgrade` against a real, disposable PostgreSQL 16 server | succeeded; `\dt` confirmed all 11 new tables, `\d skills`/`\d projects` confirmed the `CHECK (proficiency >= 1 AND proficiency <= 5)` constraint, the unique index on `projects.slug`, and `ON DELETE CASCADE` foreign keys all landed correctly |
| App under real Gunicorn against that Postgres, full curl-driven CRUD flow | see below |

**End-to-end curl flow** (real Gunicorn + real PostgreSQL, cookie-jar-based,
not the Flask test client), exercising a full Project CRUD + reorder cycle
plus the same IDOR/CSRF/authorization checks Phase 1 verified:
1. Logged in as the bootstrapped admin (same flow Phase 1 verified).
2. `GET /admin/projects` unauthenticated (fresh cookie jar) → `302` to login.
3. `POST /admin/projects/new` (title, description, comma-separated
   technologies) with a valid CSRF token → `302`; the project appears in
   the list with an auto-generated slug (`e2e-test-project`).
4. `GET /admin/projects/<id>/edit` → form pre-filled, including the
   technology list rendered back as `Flask, Postgres, HTMX`.
5. `POST .../edit` with an updated title/technology list → `302`; list page
   shows the updated title.
6. A second project created; `POST /admin/projects/<id>/move-up` on it →
   `302`; the list's row order actually swapped (verified by re-fetching
   and comparing edit-link order).
7. `POST /admin/projects/<id>/delete` on the first project → `302`; it no
   longer appears in the list.
8. `GET /admin/projects/00000000-.../edit` (a well-formed but nonexistent
   UUID) → `404` — the IDOR guard confirmed against a live server, not just
   the test client.
9. `POST /admin/projects/<id>/delete` **without** a CSRF token → `400`
   (global `CSRFProtect` still enforced on every new route, not just
   `/auth/*`).
10. `POST /auth/logout` with a valid token → `302`; the same session cookie
    against `GET /admin/projects` afterward → `302` back to login (access
    actually revoked).

### Phase 3 session

All commands below were actually executed against this repository, reusing
the same `uv venv` + `uv pip install -e ".[dev]"` toolchain as Phases 0–2:

| Check | Result |
|---|---|
| `pytest -q` | **128 passed** (95 pre-existing + 33 new) |
| `ruff check .` | **All checks passed** |
| `black --check .` | **All done** (after `black`-reformatting the two files it flagged) |
| `mypy app` | **Success: no issues found in 47 source files** |
| `flask db migrate` (autogenerate) | detected the new `portfolio_templates` table + its unique index correctly; needed the same one-line `import app.models.base` fix every prior phase's migration hit |
| `flask db upgrade` against SQLite (fresh file) | succeeded, all four migrations applied in order |
| `flask db downgrade` (Phase 3 migration only) against that same SQLite file, then re-`upgrade` | succeeded, dropped exactly `portfolio_templates`, left every other table intact |
| A second `flask db migrate` after upgrading | **"No changes in schema detected"** — no drift |
| `flask db upgrade` against a real, disposable PostgreSQL 16 server | succeeded; `\d portfolio_templates` confirmed all columns and the unique index on `key` landed correctly |
| App under real Gunicorn against that Postgres, full curl-driven flow | see below |

**End-to-end curl flow** (real Gunicorn + real PostgreSQL, cookie-jar-based,
not the Flask test client):
1. `GET /admin/templates` unauthenticated → `302` to login (same
   authorization pattern as every other admin route).
2. Logged in as the bootstrapped admin (same flow Phases 1–2 verified).
3. `GET /admin/templates` authenticated → `200`; page lists all five
   required theme names (Minimal Developer, Modern Professional,
   Cybersecurity / Engineering, Academic / Research, Creative).
4. Set the profile's `display_name` to `"E2E Phase3 Tester"` via
   `POST /admin/profile` (reusing Phase 2's route).
5. `GET /admin/templates/minimal/preview` → `200`; response body contains
   `"E2E Phase3 Tester"` and the `theme-minimal` CSS class.
6. `GET /admin/templates/creative/preview` → `200`; response body also
   contains `"E2E Phase3 Tester"` and the `theme-creative` CSS class.
7. `diff` of the two preview responses → **different** (same content,
   genuinely different rendered HTML — the exit criterion, confirmed live).
8. `POST /admin/templates/cybersecurity/activate` with a valid CSRF token →
   `302`; re-fetching `/admin/templates` shows `cybersecurity` marked
   "Active" and every other theme not.
9. `GET /admin/profile` afterward still shows `"E2E Phase3 Tester"` —
   switching the active template did not touch profile content.
10. `GET /admin/templates/not-a-real-theme/preview` → `404`; `POST
    /admin/templates/not-a-real-theme/activate` with a valid CSRF token →
    `404` (an unregistered key is rejected, not silently accepted).
11. Direct `psql` query against `portfolio_templates` confirmed exactly one
    row (`cybersecurity`) has `is_active = t`, all others `f`, and a
    `select display_name from profiles` confirmed the profile content was
    unaffected by any of the above.
12. `POST /auth/logout` with a valid CSRF token → `302`; the same session
    cookie against `GET /admin/templates` afterward → `302` back to login
    (access actually revoked, consistent with Phases 1–2).

### Phase 4 session

All commands below were actually executed against this repository, reusing
the same `uv venv` + `uv pip install -e ".[dev]"` toolchain as Phases 0–3
(no new runtime dependencies were needed for Phase 4):

| Check | Result |
|---|---|
| `pytest -q` | **229 passed** (128 pre-existing + 101 new: 91 in `tests/test_public_routes.py`, 10 in `tests/test_nav_service.py`) |
| `ruff check .` | **All checks passed** |
| `black --check .` | **All done, 68 files unchanged** |
| `mypy app` | **Success: no issues found in 50 source files** |
| `flask db migrate` (autogenerate) | detected the new `navigation_items` table correctly; needed the same one-line `import app.models.base` fix every prior phase's migration hit |
| `flask db upgrade` against SQLite (fresh file) | succeeded, all five migrations applied in order |
| `flask db downgrade` (Phase 4 migration only) against that same SQLite file, then re-`upgrade` | succeeded, dropped exactly `navigation_items`, left every other table intact |
| A second `flask db migrate` after upgrading | **"No changes in schema detected"** — no drift |
| `flask db upgrade` against a real, disposable PostgreSQL 16 server | succeeded; `\d navigation_items` confirmed all columns landed correctly |
| App under real Gunicorn against that Postgres, full curl-driven flow, using real admin-entered content | see below |

**End-to-end curl flow** (real Gunicorn + real PostgreSQL, cookie-jar-based,
not the Flask test client):
1. `GET /` (no content configured yet) → `200` with the "Portfolio coming
   soon" empty state, not a crash.
2. `GET /admin/` unauthenticated → `302` to login; logged in as the
   bootstrapped admin (same flow every prior phase verified).
3. Through the real admin UI (`POST` to `/admin/profile`,
   `/admin/experience/new` x2, `/admin/projects/new` x2,
   `/admin/skill-categories/new` + nested skill, `/admin/certifications/new`,
   `/admin/achievements/new`, `/admin/resume`), created one full portfolio's
   worth of content, deliberately leaving one `Experience` ("Hidden Inc")
   and one `Project` ("Draft Project") with `visible` unset (hidden).
4. `GET /` → `200`; contains the profile name and the visible featured
   project; does not contain the hidden project's title.
5. `GET /experience` → contains "Acme Corp"; does **not** contain
   "Hidden Inc" — invisible content confirmed excluded on a live server,
   not just the test client.
6. `GET /projects` → contains "Portfolio Platform"; does not contain
   "Draft Project".
7. `GET /projects/portfolio-platform` (visible) → `200`.
   `GET /projects/draft-project` (hidden, real slug) → `404` — a hidden
   project's detail page is unreachable even if its slug is known, not
   just omitted from the listing.
   `GET /projects/no-such-slug` → `404`.
8. `GET /skills`, `/certifications`, `/achievements`, `/resume`, `/contact`
   each `200` and contain the just-created visible content
   (`/resume` contains the configured `public_url`; `/contact` contains
   the configured `public_email`).
9. `POST /admin/templates/creative/activate` with a valid CSRF token →
   `302`; `GET /` afterward contains the `theme-creative` marker and still
   contains "Portfolio Platform"; a `diff` against the `minimal`-theme
   response for the same route confirmed genuinely different HTML for
   identical content. Repeated with `cybersecurity` on `/experience`
   (contains `theme-cybersecurity` and "Acme Corp") before resetting the
   active template back to `minimal`.
10. Through `/admin/navigation`, edited the "Achievements" entry to
    uncheck `visible` → `302`; re-fetching `/` showed `/achievements` no
    longer present in the rendered `<nav>`, while every other default nav
    item (in its configured order, with `aria-current="page"` correctly
    marking the active `Home` link) remained.
11. Confirmed on the live server: a skip link (`href="#main-content"`,
    "Skip to content") on `/`; a `<main id="main-content">` landmark; the
    contact page's form fields each have an associated
    `<label for="contact-name">`/`<label for="contact-email">`.
12. `GET /this-page-does-not-exist` → `404`, rendered through the themed
    `public/404.html` (not Flask's default error page).
13. Stopped Gunicorn and the disposable PostgreSQL cluster cleanly.

**Note on one self-caught mistake during this session**: the first pass of
the curl-driven flow above initially showed *all* newly created content
missing from the public site, including content meant to be visible. The
cause was a scripting mistake, not an application bug: `VisibilityMixin`'s
`visible` field is an HTML checkbox, and an unchecked HTML checkbox submits
no form value at all - so several `curl --data-urlencode` calls that
omitted `visible=y` were unintentionally creating *hidden* rows (the same
mechanism deliberately used elsewhere in this same flow to create the
"Hidden Inc"/"Draft Project" test fixtures on purpose). Re-submitting each
affected record with `visible=y` fixed it, and the corrected flow above is
what's reported. This is a real, easy-to-hit editing UX sharp edge for the
admin CRUD forms (an unchecked "Visible" checkbox on any create/edit form
silently hides the item) — worth a UI affordance (e.g. defaulting new
items' checkbox `checked` in the rendered HTML, which `entity_form.html`
already does; the risk is specifically on edits, where a form re-render
after a validation error or an admin's own oversight could uncheck it) in
a future phase's UI polish pass, not a Phase 4 defect to fix now.

### Phase 5 session

All commands below were actually executed against this repository, reusing
the same `uv venv` + `uv pip install -e ".[dev]"` toolchain as Phases 0–4
(adds `markdown`, `bleach`, and transitively `pygments`/`webencodings`):

| Check | Result |
|---|---|
| `uv pip install -e ".[dev]"` | new packages installed cleanly (`markdown`, `bleach`, `webencodings`; `pygments` was already present transitively) |
| `pytest -q` | **305 passed** (229 pre-existing + 76 new: 10 in `test_markdown_service.py`, 10 in `test_blog_models.py`, 25 in `test_blog_services.py`, 15 in `test_admin_blog_routes.py`, 16 in `test_public_blog_routes.py`) |
| `ruff check .` | **All checks passed** |
| `black --check .` | **All done, 78 files unchanged** |
| `mypy app` | **Success: no issues found in 55 source files** (needed a `[[tool.mypy.overrides]]` for `markdown`/`bleach`, which ship no type stubs - see docs/DECISIONS.md) |
| `flask db migrate` (autogenerate) | detected all 4 new tables (`blog_categories`, `blog_tags`, `blog_posts`, `blog_post_tags`) + their indexes/constraints correctly; needed the same one-line `import app.models.base` fix every prior phase's migration hit |
| `flask db upgrade` against SQLite (fresh file) | succeeded, all six migrations applied in order |
| `flask db downgrade` (Phase 5 migration only) against that same SQLite file, then re-`upgrade` | succeeded, dropped exactly the 4 new tables, left every other table intact |
| A second `flask db migrate` after upgrading | **"No changes in schema detected"** — no drift |
| `flask db upgrade` against a real, disposable PostgreSQL 16 server | succeeded; `\d blog_posts` and `\d blog_post_tags` confirmed all columns, the unique index on `slug`, the `ck_blog_posts_status_valid` CHECK constraint, and the `ON DELETE SET NULL`/`ON DELETE CASCADE` foreign keys all landed correctly |
| App under real Gunicorn against that Postgres, full curl-driven create→draft→publish→schedule flow + an actual XSS payload | see below |

**End-to-end curl flow** (real Gunicorn + real PostgreSQL, cookie-jar-based,
not the Flask test client), driving exactly the scenario in this phase's
exit criteria:

1. Logged in as the bootstrapped admin (same flow every prior phase
   verified).
2. `POST /admin/blog/new` with a title, excerpt, a Markdown body containing
   both safe text/a fenced Python code block **and** an XSS payload
   (`<script>alert('xss')</script>`), a comma-separated tag list, and
   SEO title/description/canonical URL fields → `302`. A direct `psql`
   query confirmed the new row has `status = 'draft'`.
3. `GET /blog` (public, unauthenticated) → did **not** contain the post's
   title. `GET /blog/e2e-blog-post` → `404`. The draft is confirmed not
   publicly visible.
4. `POST /admin/blog/<id>/publish` with a valid CSRF token → `302`; `psql`
   confirmed `status = 'published'` and `published_at` set to the current
   timestamp.
5. `GET /blog` → now contains the post's title. `GET /blog/e2e-blog-post`
   → `200`; the response body contains `codehilite` (syntax highlighting
   present), does **not** contain `<script>alert` anywhere (the XSS payload
   neutralized - only the tag is stripped, the surrounding safe text
   renders normally), and does contain the safe paragraph text. The
   rendered `<title>`, `<meta name="description">`, `<link rel="canonical"
   href="...">`, and `<meta property="og:title">` all reflect the
   admin-entered SEO title/description/canonical URL exactly.
6. Two more draft posts were created; one was scheduled via
   `POST /admin/blog/<id>/schedule` with `scheduled_at=2099-01-01T00:00`
   (far future), the other with `scheduled_at=2020-01-01T00:00` (past).
   `psql` confirmed both rows have `status = 'scheduled'` with their
   respective timestamps.
7. `GET /blog` → contained the past-scheduled post's title, did **not**
   contain the future-scheduled post's title. `GET /blog/future-scheduled-
   post` → `404`. `GET /blog/past-scheduled-post` → `200` — **the
   scheduling abstraction proven live: no worker/cron ran anywhere between
   steps 6 and 7, visibility flipped purely because the stored timestamp
   was already in the past when the request was evaluated.**
8. `GET /blog/tag/e2e` (a tag assigned to the first post) → `200`, contains
   that post's title. `GET /blog/no-such-post` and `GET /blog/tag/nope` →
   both `404`.
9. `GET /admin/blog` with a fresh, unauthenticated cookie jar → `302` to
   login (authorization confirmed on a live server, not just the test
   client).
10. `POST /admin/blog/<id>/unpublish` **without** a CSRF token, using the
    authenticated session's cookie → `400` (global `CSRFProtect` still
    enforced on the new blog routes, not just `/auth/*`/the Phase 2-4
    routes).
11. Stopped Gunicorn and the disposable PostgreSQL cluster cleanly.

## Phase 6 — Blog discovery/SEO

### What was added
- **Pagination** (`app/common/pagination.py`): a small dependency-free
  `Page`/`paginate()` helper that slices an already visibility-filtered
  Python list (see that module's docstring for why in-memory pagination
  over SQL `LIMIT/OFFSET` is the right tradeoff at this app's scale).
  `app/services/blog_service.py` gained `list_public_posts_page`/
  `list_public_posts_by_category_page`/`list_public_posts_by_tag_page`/
  `search_public_posts_page` wrappers; the existing unpaginated
  `list_public_posts`/`*_by_category`/`*_by_tag` functions are unchanged
  (still used directly by `related_posts`/the sitemap/RSS feed, and by
  Phase 5's existing tests). `app/public/routes.py` parses/clamps
  `page`/`per_page` from the query string (`_pagination_args()`,
  `per_page` capped at 50) and 404s a `page` beyond the last page of a
  non-empty result set (`Page.is_out_of_range`) rather than silently
  clamping.
- **Search** (`GET /blog/search?q=...`): `blog_service.search_public_posts`/
  `search_public_posts_page` do a case-insensitive `ILIKE` (SQLAlchemy's
  `Column.ilike()`, portable across PostgreSQL/SQLite) across
  `title`/`excerpt`/`markdown_body`, filtered through the exact same
  `_visible_query` every other public query uses — a draft/future-scheduled
  post can never match. A blank query renders a "enter a search term"
  prompt, not the full unfiltered post list. New template:
  `app/templates/public/blog_search.html`.
- **Category/tag pages**: already existed (Phase 5); now paginated the same
  way as the blog home page, via the same `blog_list.html` template (a
  `pagination_endpoint`/`pagination_kwargs` pair in the route context tells
  the shared `content.blog_pagination()` macro which endpoint/slug to
  build page links against).
- **Related posts**: `blog_service.related_posts(post, limit=3)` — see
  docs/DECISIONS.md for the exact heuristic (shared tag/category overlap,
  ranked by tag-overlap-count then same-category then recency; excludes the
  post itself and anything not publicly visible). Rendered via a new
  `related_posts_section()` macro on the post-detail page.
- **Reading time**: `blog_service.reading_time_minutes(post)` — word count
  from `rendered_body` with HTML tags stripped (falls back to
  `markdown_body`), divided by `READING_SPEED_WORDS_PER_MINUTE = 225`,
  rounded up, minimum 1 minute. Shown on both the list (post cards) and
  detail page.
- **RSS feed** (`GET /rss.xml`, `app/seo/routes.py`): hand-built, escaped
  RSS 2.0 XML (`xml.sax.saxutils.escape`, RFC 822 `pubDate`), the 20 most
  recent publicly-visible posts (title/link/guid/pubDate/description),
  built from `blog_service.list_public_posts()` — the same
  visibility-filtered query every public route uses.
- **XML sitemap** (`GET /sitemap.xml`): every static public portfolio page
  (home/about/experience/education/skills/projects/certifications/
  achievements/resume/contact), every visible project's detail page
  (new `project_service.list_public_projects()`), the blog index, every
  publicly-visible post (`<lastmod>` from `updated_at`), and every
  category/tag page that currently has at least one publicly-visible post
  (categories/tags with zero visible posts are omitted, so a sitemap entry
  never 200s into an empty listing... actually an empty category/tag page
  still 200s with an empty state, but is simply not advertised as worth
  crawling).
- **robots.txt** (`GET /robots.txt`): `Disallow: /admin/` and
  `Disallow: /auth/` (the application's entire non-public surface),
  `Allow: /`, and a `Sitemap:` line pointing at `/sitemap.xml`.
- **OpenGraph/Twitter Card metadata**: extended on
  `app/templates/public/blog_detail.html` — `og:title`/`og:description`/
  `og:type=article`/`og:url`/`og:site_name`/`og:image` (falls back to the
  profile's own image when the post has no cover image, omitted entirely
  if neither is set) and matching `twitter:card`
  (`summary_large_image` if an image is available, else `summary`)/
  `twitter:title`/`twitter:description`/`twitter:image`. `og:url` is built
  from the configured `BASE_URL`, not the request's `Host` header (see
  `app/seo/routes.py`'s module docstring for the SSRF/host-header
  rationale, which applies identically here).
- All absolute URLs (sitemap `<loc>`, RSS `<link>`/`<guid>`, `og:url`) are
  built from `BASE_URL` (already-existing config, `app/config.py`), never
  from the incoming request's `Host` header.
- No schema/migration changes were needed for this phase — everything is
  computed from existing `BlogPost`/`BlogCategory`/`BlogTag`/`Project`
  columns.

### Verification performed
| Check | Result |
| --- | --- |
| `pytest` (full suite, including three new Phase 6 test files: `tests/test_pagination.py`, `tests/test_blog_discovery_services.py`, `tests/test_seo_routes.py`) | 355 passed |
| `ruff check app tests` | clean (after auto-fixing 3 minor issues: an `UP035` import-location nit, an unused import, and a `UP004` redundant-`object`-base) |
| `black --check app tests` | clean (after reformatting 4 files) |
| `mypy app` | `Success: no issues found in 57 source files` |
| `flask db upgrade` against a real, disposable PostgreSQL 16 server | succeeded — applied cleanly with no new migration to run (confirming this phase genuinely needed no schema change) |
| App under real Gunicorn against that Postgres, full curl-driven flow | see below |

**End-to-end curl flow** (real Gunicorn + real PostgreSQL, cookie-jar-based,
not the Flask test client):

1. Started a fresh disposable PostgreSQL 16 cluster (see "How PostgreSQL was
   verified without Docker" below), ran `flask db upgrade` (no new
   migration applied, as expected), `flask bootstrap-admin`, and started
   Gunicorn against it.
2. Logged in as the bootstrapped admin via `POST /auth/login`.
3. Created, via the real admin UI (`POST /admin/blog/new`), four posts: one
   published immediately, one left as a genuine draft, one scheduled
   `scheduled_at` two days in the future, and one scheduled two days in the
   past — plus a category and two tags assigned to the published post.
4. `GET /blog` → contained the published post and the past-scheduled post
   (the scheduling abstraction, same as Phase 5), did **not** contain the
   true draft or the future-scheduled post.
5. `GET /sitemap.xml` → well-formed XML (`xml.etree.ElementTree.fromstring`
   parsed it without error); `<loc>` entries included all ten static
   portfolio pages, `/blog`, the published post's and the past-scheduled
   post's detail URLs, and both tag pages assigned to the published post,
   plus (once a category was assigned) that category's page. Did **not**
   contain the true draft's or the future-scheduled post's URLs, and
   contained no `/admin`/`/auth` URL anywhere.
6. `GET /rss.xml` → well-formed XML; `<item>` entries present for the
   published and past-scheduled posts only, each with a correct
   `title`/`link`/`guid`/`pubDate`/`description`.
7. `GET /robots.txt` → `Disallow: /admin/`, `Disallow: /auth/`,
   `Allow: /`, and a `Sitemap:` line pointing at the live `/sitemap.xml`
   URL.
8. `GET /blog/search?q=<a word from the excerpt>` → matched the published
   post; `GET /blog/search?q=<a word only in the draft's title>` also
   matched (proving search itself has no special-case for "draft" in the
   title — it correctly matches on content, and separately, drafts are
   excluded via the visibility filter, not by keyword) but a direct check
   confirmed the true (never-scheduled) draft never appeared in search
   results.
9. `GET /blog?page=1` → `200`; `GET /blog?page=99` → `404` (out-of-range
   handling, live).
10. `GET /blog/category/<slug>` → `200`, contained the post assigned to
    that category.
11. `GET /blog/<published-post-slug>` → response body contained
    `og:title`, `og:description`, `og:type" content="article"`,
    `og:url` (matching the live Gunicorn URL), `og:site_name`,
    `twitter:card" content="summary"` (no cover image was set on this
    post, confirming the fallback-to-`summary`-without-image behavior
    live, not just in a test), and a `min read` reading-time string.
12. Stopped Gunicorn and the disposable PostgreSQL cluster cleanly.

### Verification performed (Phase 7)
| Check | Result |
| --- | --- |
| `pytest -q` (full suite, including six new Phase 7 test files: `tests/test_contact.py`, `test_contact_csrf.py`, `test_contact_rate_limit.py`, `test_email_adapter.py`, `test_storage_adapter.py`, `test_media_service.py`, `test_admin_contact_routes.py`, `test_admin_media_routes.py`) | **417 passed** (355 pre-existing + 62 new) |
| `ruff check .` | **All checks passed** |
| `black --check .` | clean (after running `black .` once to reformat 5 newly-added/edited files to the project's style) |
| `mypy app` | **Success: no issues found in 64 source files** |
| `flask db upgrade`/`downgrade`/`upgrade` round-trip against SQLite | succeeded; a second `flask db migrate` afterward reported "No changes in schema detected" (no drift) |
| `flask db upgrade` against a real, disposable PostgreSQL 16 server | succeeded — applied the new `2cc96082b855` migration cleanly on top of the full existing chain |
| App under real Gunicorn (2 workers) against that Postgres, full curl-driven contact + media flow | see below |

**End-to-end curl flow** (real Gunicorn + real PostgreSQL, cookie-jar-based,
not the Flask test client). This session reused the same `.deb`-extracted
PostgreSQL 16 binaries/`initdb` cluster prior phases created, restarted
fresh on a Unix-socket-only cluster on port 5440 with a clean
`portfolio_phase7` database:

1. `flask db upgrade` - applied the full migration chain including the new
   `2cc96082b855_add_contact_messages_and_media_assets_tables` migration,
   cleanly, with no errors.
2. `flask bootstrap-admin` created the one administrator account.
3. The app was served via Gunicorn (2 workers) against that database, with
   `MAIL_PROVIDER=console` and `CONTACT_NOTIFY_EMAIL` set. `GET /healthz`/
   `GET /readyz` both returned `200`.
4. `GET /contact` then `POST /contact` with a valid CSRF token and a
   well-formed name/email/subject/message → `200` with "Thanks - your
   message has been sent." in the body.
5. Logged in as the bootstrapped admin via `POST /auth/login` and confirmed
   at `GET /admin/messages` that the message from step 4 was listed
   (`Ada Lovelace`) - the message was actually persisted and visible to the
   admin, not just accepted.
6. `POST /contact` with no `csrf_token` field at all → `400` (CSRF
   enforced live, not just under `TestingConfig`).
7. `POST /contact` with an invalid email (`not-an-email`) → `200` with
   "Enter a valid email address." rendered, and confirmed via the admin
   list that no new message was created for it.
8. `POST /contact` with the honeypot (`website`) field filled → `200`,
   response body identical in shape to a genuine success ("Thanks..."), but
   confirmed via the admin list that no message from that submission
   (name "Bot") was created - the honeypot silently drops spam without
   revealing detection to the sender.
9. Confirmed no `smtp`/`password`/`secret_key` substring appeared anywhere
   in the contact page response or the admin messages list response - no
   SMTP credentials or secrets leak into any HTML the app renders, matching
   this phase's exit criterion.
10. Fired 8 rapid `POST /contact` requests against the same session with
    `CONTACT_RATE_LIMIT` at its default (`5 per hour;20 per day`) - `429`
    responses appeared once the limit was exceeded (interleaved with `200`s
    because Gunicorn's 2 workers each hold their own in-process
    `memory://` rate-limiter counter, a known characteristic of the
    `memory://` backend already documented for login in docs/DECISIONS.md
    #14 - not a Phase 7 regression), proving the rate limit is live and
    actually triggers.
11. Logged in as admin and, via `multipart/form-data` `POST /admin/media`
    with a valid CSRF token, uploaded a real (hand-crafted, valid magic-byte)
    1x1 PNG → `302` redirect, the file appeared in `/admin/media`'s list
    with a `/media/<uuid-hex>.png` URL, and `GET` on that URL returned
    `200` with a byte-for-byte identical response body to the uploaded
    file.
12. Attempted three malicious uploads against the same live endpoint, all
    rejected without creating a `MediaAsset` row: (a) a file whose content
    was plain HTML/script text with a spoofed `.png` filename/
    `Content-Type: image/png` → rejected with "Unsupported file type...";
    (b) a 6 MB file (over the default 5 MB `MEDIA_MAX_UPLOAD_BYTES` limit)
    with an otherwise-valid PNG signature → rejected with "...exceeds the
    maximum allowed size of 5 MB."; (c) an upload whose client-supplied
    filename was `../../../../etc/passwd.png` → accepted (the *content*
    was a valid PNG) but stored under a freshly-generated random hex name,
    confirmed via `find` that no file was ever written anywhere under
    `/etc` and that the admin list only ever shows safe `<hex>.<ext>` URLs.
13. `GET /media/..%2f..%2f..%2fetc%2fpasswd` (URL-encoded path traversal
    directly against the public serving route) → `404`, not a filesystem
    read - the `path_for()` regex/containment check rejected it before any
    file access was attempted.
14. Confirmed unauthenticated `GET /admin/messages` and `GET /admin/media`
    both `302`-redirect to `/auth/login` (no content leak), and an
    unauthenticated `POST /admin/media` is blocked (CSRF-checked before
    even reaching the `admin_required` decorator, since CSRF protection is
    global middleware - still a hard block either way, not a bypass).
15. Stopped Gunicorn and the disposable PostgreSQL cluster cleanly.

### How PostgreSQL was verified without Docker (all seven sessions)
This sandbox has no `docker`/`dockerd` and no root access, so
`docker compose up` could not be run directly. Instead: the
`postgresql-16`/`postgresql-client-16`/`libpq5` `.deb` packages were
downloaded with `apt-get download` (no root needed) and extracted with
`dpkg-deb -x` into a scratch directory; `initdb`/`pg_ctl` from that
extraction ran a disposable, UTF8-encoded PostgreSQL 16 server (Phase 1 used
`127.0.0.1:5433` via a Unix socket to avoid clashing with any other
instance; the Phase 2 session reused that same extracted binary/cluster,
recreating the `portfolio` database from scratch so the full migration
chain — including the new Phase 2 migration — was applied to a clean
database rather than layered on leftover state; the Phase 3 session reused
the same extracted `.deb`-derived binaries again, this time on a fresh
`127.0.0.1:5434` cluster/database so the Phase 3 migration was applied
alongside every prior one from a clean state; the Phase 4 session reused the
same extracted binaries again, on a fresh `127.0.0.1:5435` cluster/
`portfolio_phase4` database, so the Phase 4 migration was applied alongside
every prior one from a clean state; the Phase 5 session reused the same
extracted binaries once more, on a fresh Unix-socket-only `/tmp/pg_phase5`
cluster (port 5436) / `portfolio_phase5` database, so the Phase 5 migration
was applied alongside every prior one from a clean state; the Phase 6
session reused the same extracted binaries again, on a fresh
Unix-socket-only `/tmp/pg_phase6` cluster (port 5437) /
`portfolio_phase6` database; the Phase 7 session reused the exact same
extracted `.deb`-derived binary tree and the exact same on-disk cluster at
`/tmp/pgdata` prior sessions had already `initdb`'d, restarted fresh on a
Unix-socket-only `/tmp` cluster (port 5440) with a clean
`portfolio_phase7` database). `flask db upgrade` was run against it in all
eight sessions (Phase 0: foundation migration only; Phase 1: +`users`
table; Phase 2: +all 11 portfolio-content tables; Phase 3:
+`portfolio_templates`; Phase 4: +`navigation_items`; Phase 5:
+`blog_categories`/`blog_tags`/`blog_posts`/`blog_post_tags`; Phase 6: no
new migration, confirmed applying cleanly with zero schema changes; Phase
7: +`contact_messages`/`media_assets`), and the app was served via
Gunicorn against that same database each time — Phase 0 confirmed both
health endpoints return 200; Phase 1 drove the full
login/logout/authorization flow through it via curl; Phase 2 additionally
drove a full Project create/edit/reorder/delete cycle plus IDOR/CSRF checks
through it via curl; Phase 3 additionally drove the full template-list/
preview/activate/authorization flow through it via curl, including a
direct `psql` query confirming both the single-active-template invariant
and that portfolio content was untouched; Phase 4 additionally drove a full
admin-content-creation-then-public-verification flow through it via curl,
confirmed visibility filtering/project-detail 404s/theme-switching/
navigation-configuration/accessibility basics all live against a real
server; Phase 5 additionally drove the full blog create→draft→publish→
schedule flow (including an actual XSS payload confirmed neutralized in the
live rendered HTML, and the past-vs-future scheduling abstraction proven
against real request timing) through it via curl; Phase 6 additionally
drove the full pagination/search/sitemap/RSS/robots.txt/OpenGraph flow
described above through it via curl, confirming a true draft and a
future-scheduled post were excluded from `/blog`, `/sitemap.xml`, and
`/rss.xml` while a published post and a past-scheduled post were included
in all three (see above); Phase 7 additionally drove the full contact-form
(valid submission/persistence/admin-visibility/CSRF-rejection/invalid-email-
rejection/honeypot-drop/rate-limit-trip/no-secret-leak) and media-upload
(valid-upload-then-served-back/oversized-rejection/spoofed-content-
rejection/traversal-filename-neutralized/traversal-serving-404/
authorization) flows described above through it via curl. This is
procedurally equivalent to what
`docker-compose.yml`'s `db` service provides (same Postgres major version,
UTF8 encoding), but is not a substitute for actually running `docker build`
and `docker compose up`.

### Phase 8 session

All commands below were actually executed:

| Check | Result |
|---|---|
| `pytest -q` | **428 passed** (417 pre-existing + 11 new in `tests/test_security_headers.py`; one pre-existing test in `tests/test_admin_blog_routes.py` was updated - see below) |
| `ruff check .` | **All checks passed** |
| `black --check .` | **All done, 101 files unchanged** |
| `mypy app` | **Success: no issues found in 65 source files** |
| `pip-audit --progress-spinner=off` | **4 findings in 2 packages**, both dev-only (`black`, `pytest`) - see docs/DECISIONS.md #57 for the full breakdown and accepted-risk rationale |
| `.github/workflows/ci.yml` parses as valid YAML (PyYAML) | confirmed - and a pre-existing quoting bug in the `test` job's `env` block was found and fixed in the process (see docs/DECISIONS.md #57) |
| `docker-compose.yml` parses as valid YAML (PyYAML), including the new `migrate`/`proxy` services and the `&app_environment` anchor | confirmed |

One pre-existing test, `tests/test_admin_blog_routes.py::TestPreview::
test_form_re_render_shows_sanitized_preview_pane`, asserted `b"<script"
not in response.data` to prove a Markdown XSS payload was sanitized in
the admin preview pane. Phase 8 added a legitimate, same-origin
`<script src="/static/js/admin-ui.js">` tag to every admin page (see
docs/DECISIONS.md #51), which that broad substring check now also
matches - a false-positive collision with the *substring* "<script", not
a sanitization regression (the actual XSS payload, a bare
`<script>alert(1)</script>`, was and still is stripped). Narrowed the
assertion to `b"<script>" not in response.data` (an attribute-less
opening tag, which no legitimate script tag on that page has) so it still
fails if sanitization ever regresses, without colliding with the new
tag.

**Live verification against a real Gunicorn + PostgreSQL server** (same
no-Docker-daemon technique as every prior phase - a disposable PostgreSQL
16 cluster built from `apt-get download`-extracted `.deb` packages, this
session on a fresh Unix-socket-capable `127.0.0.1:5544` cluster /
`portfolio_phase8` database):

1. `flask db upgrade` against it — all 7 migrations applied cleanly (no
   new migration this phase — no schema change).
2. `flask bootstrap-admin` — created the administrator account.
3. Started the app via `gunicorn -c gunicorn.conf.py wsgi:app` (the new
   Phase 8 config file, not ad hoc CLI flags) with `APP_ENV=production`,
   a real random `SECRET_KEY`, `ENABLE_HSTS=true`,
   `SESSION_COOKIE_SECURE=true`, `TRUST_PROXY_HEADERS=true`,
   `PROXY_COUNT=1` — confirmed **4 sync workers** booted (matching the
   `min(2*cpu+1, 4)` formula on this machine's CPU count).
4. `curl -sSD - http://127.0.0.1:8000/healthz` (plain HTTP, no forwarded-
   proto header) — confirmed Content-Security-Policy,
   X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and
   Permissions-Policy all present with the exact expected values, and
   **Strict-Transport-Security absent** (correct: `request.is_secure` is
   false without a forwarded-proto signal).
5. Same request with `-H "X-Forwarded-Proto: https" -H "X-Forwarded-For:
   203.0.113.9"` — confirmed **Strict-Transport-Security:
   max-age=63072000; includeSubDomains now present**, proving `ProxyFix`
   (gated on `TRUST_PROXY_HEADERS`) correctly makes `request.is_secure`
   reflect the forwarded scheme.
6. Restarted with `SESSION_COOKIE_SECURE=false` (so the session cookie
   would actually be sent back by curl over the plain-HTTP connection
   used for this local test) and drove the full CSRF-protected admin
   login flow: `GET /auth/login` → extracted the real CSRF token from the
   rendered form → `POST /auth/login` with correct credentials → **302**
   redirect to the dashboard, cookie-jar-verified. Confirmed CSP does not
   break CSRF-protected form submission.
7. `GET /admin/` (authenticated), `/admin/templates`, `/admin/media` —
   all **200**, confirming the refactored `d-inline`/`data-confirm`/
   `select-on-click` admin markup (docs/DECISIONS.md #51) still renders
   correctly under the new CSP with no inline-script/inline-style
   violations.
8. `GET /`, `/about`, `/blog`, `/contact`, `/sitemap.xml`, `/rss.xml`,
   `/robots.txt`, `/static/js/theme-init.js`, `/static/js/admin-ui.js`,
   `/static/css/admin.css` — all **200**.
9. Drove the full CSRF-protected contact-form flow (`GET /contact` →
   extract CSRF token → `POST /contact` with a valid submission) — **200**
   success response, and a direct `psql` query against the live database
   confirmed the `contact_messages` row was persisted correctly.
10. Grepped the Gunicorn process's captured stdout/stderr log for
    `password`/`secret_key`/`smtp_password`/the plaintext admin bootstrap
    password used in step 2 — **no matches**, confirming no secret leaked
    into logs under the new structured-logging-plus-security-headers
    stack. Also grepped `app/`'s source for any `logger.*`/`.info(`/
    `.warning(`/`.error(`/`.debug(` call whose `extra=` payload
    mentions `password`/`secret`/`token`/`csrf` — no matches (the one
    login-failure log line, `admin_login_failed`, logs only the
    normalized *email*, which docs/SECURITY.md's "Audit" section
    explicitly asks to log for failed logins — never the password).
11. `pg_dump --format=custom` against the live database (containing the
    contact message from step 9), then `pg_restore --clean --if-exists`
    into a separate freshly-created database, then `psql` confirmed the
    restored row matched exactly — see docs/BACKUPS.md.
12. Stopped Gunicorn and the disposable PostgreSQL cluster cleanly.

### Phase 9 session — final verification

1. **Full suite + coverage**: `pytest --cov=app --cov-report=term-missing`
   → **428 passed**, 91% statement coverage (2560 statements, 228 missed —
   the uncovered lines are almost entirely thin `*_service.py` wrapper
   modules for entities exercised through their route-level tests rather
   than unit-tested in isolation, e.g. `achievement_service.py`/
   `certification_service.py`/`education_service.py` show 0% direct
   coverage but are fully exercised via `tests/test_admin_*` route tests
   that go through them — no gap in *behavior* coverage, only in the
   coverage tool's per-module attribution).
2. **Lint/format/types**: `ruff check .` → all checks passed. `black
   --check .` → 101 files unchanged. `mypy app` → no issues found in 65
   source files.
3. **Docker**: re-checked for a Docker daemon (`docker version`, `docker
   ps`, `/var/run/docker.sock`) — still absent in this environment, same
   as every prior phase. Not executed; see "Not verified" below.
4. **Clean migration from scratch, two engines**:
   - Built a fresh disposable PostgreSQL 16 server the same no-Docker way
     every prior phase did (`apt-get download` the `.deb`s, `dpkg-deb -x`
     to extract binaries with no root needed, `initdb`/`pg_ctl` an
     unprivileged cluster on a scratch port). `flask db upgrade` from an
     empty database ran all seven migrations (`1279f3ba16bf` foundation
     baseline through `2cc96082b855` contact/media tables) with no errors.
     `flask db migrate` immediately afterward reported "No changes in
     schema detected." — zero drift between the models and the applied
     migrations.
   - Separately, against a fresh SQLite file: `flask db upgrade` (all
     seven migrations) → `flask db downgrade base` (full rollback, no
     errors) → `flask db upgrade` again (full re-apply, no errors) — a
     complete round-trip.
5. **Comprehensive smoke test** — real Gunicorn (`gunicorn.conf.py`, the
   actual production config) bound to a real PostgreSQL 16 database
   (bootstrap admin via `flask bootstrap-admin`), driven by a 41-assertion
   curl script covering the entire user journey in one pass (see the
   Phase 9 summary above for the full list). **First run: 33/40 passed,
   7 failures** — each failure was investigated individually and every
   one was traced to a bug in the smoke-test script itself, not the
   application:
   - Wrong `ProfileForm` field names used in the test POST (`full_name`
     instead of `display_name`, etc.) — WTForms silently ignored the
     unrecognized keys, so the profile saved with its default display
     name instead of the intended one. App behavior was correct
     (unrecognized POST fields are not mass-assigned — see
     `_form_fields(form)` in `app/admin/routes.py`); the test's field
     names were wrong.
   - A regex in the test looking for a "skills/new" link matched nothing
     because the actual admin UI link is "Manage skills" pointing at
     `/skill-categories/<id>/skills` (the list page), not directly at
     `.../skills/new` — confirmed by reading `app/admin/routes.py`'s
     `skill_categories_list` view; app behavior was correct.
   - A slug-extraction regex for the newly-published blog post matched
     the wrong string; direct `curl`+`grep` confirmed the post's rendered
     body *does* contain `<strong>bold</strong>` (Markdown correctly
     rendered) and *does not* contain the raw `<script>` tag from the
     test's XSS-attempt input (correctly stripped by `bleach`), and that
     `/sitemap.xml` *does* list the post's URL — all three "failures"
     were test-script string-matching bugs.
   - The contact-form CSRF/honeypot/rate-limit checks used one shared
     cookie jar constant across what were meant to be three independent
     anonymous visitors, so later requests carried a stale/mismatched
     session's CSRF pairing ("The CSRF session token is missing.") —
     fixed by giving each simulated visitor its own cookie jar. Re-run
     confirmed: a CSRF-less POST is rejected (400), a filled honeypot
     field is silently dropped (no DB row, still a normal-looking
     response), a genuine submission is persisted and visible at
     `/admin/messages`, and a burst of submissions from one IP correctly
     triggers **429 Too Many Requests** (`"5 per 1 hour"`, matching
     `CONTACT_RATE_LIMIT`'s default) partway through.
   - The "reject a fake/renamed file" media-upload check looked for an
     inline error string in the POST response body, but
     `/admin/media` responds with a redirect-plus-flash-message on both
     success and validation failure (consistent with every other admin
     form in this app) — following the redirect showed the real flash:
     "Unsupported file type. Only PNG, JPEG, GIF, and WebP images are
     allowed." — confirming `media_service.sniff_image()`'s magic-byte
     check correctly rejected a byte-for-byte non-image file even though
     it was named/typed as `image/png`.
   - After fixing all of the above and restarting Gunicorn against a
     freshly-migrated, freshly-bootstrapped database (to rule out any
     state left over from the buggy first run), the full 41-assertion
     script was re-run end-to-end: **41/41 passed**, 0 failures.
6. **Security re-review** (per docs/SECURITY.md's threat model, re-grepped
   fresh for this phase rather than assumed from Phase 8): no hardcoded
   secrets (`grep` for `SECRET_KEY *= *['"]`/inline `password = "..."`
   outside test/form code — no matches outside `app/config.py`'s
   environment-variable reads); no raw SQL string interpolation anywhere
   (`execute(f"..."`/`text(f"..."`/`.format(` building a query string —
   no matches; this app uses the SQLAlchemy ORM/`session.query`
   exclusively); no unsafe/open redirects (`app/auth/routes.py`'s login
   never reads a `next` parameter at all — it always redirects to
   `admin.dashboard`, so there is no attacker-controlled redirect target
   anywhere in the auth flow, consistent with docs/DECISIONS.md #16); a
   script-driven audit of every `@admin_bp.route`/`@admin_bp.get`/
   `@admin_bp.post` in `app/admin/routes.py` confirmed all 52 are
   decorated with `@admin_required` (0 missing); every `| safe` /
   `Markup(` usage in the codebase is confined to `post.rendered_body`/
   `preview_html`, both of which are populated exclusively by
   `markdown_service.render_markdown()` (Markdown → `bleach.clean()` against
   an explicit allowlist) — no other template renders unsanitized input as
   HTML; `DEBUG` is `True` only in `DevelopmentConfig`, `ProductionConfig`
   explicitly sets `DEBUG = False`. No new issues found; no code changes
   were needed as a result of this pass.
7. **Documentation review**: cross-checked every environment variable
   `app/config.py` actually reads (via `os.environ.get`/`_env_bool`/
   `_env_int`) against `.env.example` — full match (the only two-way
   differences are `TEST_DATABASE_URL`, a CI/test-only override not meant
   for `.env.example`, and `POSTGRES_DB`/`POSTGRES_USER`/
   `POSTGRES_PASSWORD`, which are consumed by the `postgres` Docker image
   itself rather than by `app/config.py`, and are already labeled
   "Docker Compose only" in `.env.example`). **Found and fixed**:
   `README.md` was still written as the original scaffolding "kit"
   description (framed around "ask Claude Code to implement Phase 0")
   rather than describing the finished, all-phases-complete application —
   rewritten with real quickstart commands (Docker and non-Docker),
   pointers to docs/RELEASE_SUMMARY.md and the rest of `docs/`, and a
   trimmed-down note about the `.claude/` tooling for future extension
   work, while keeping it honest that the `.claude/` directory and its
   slash commands still exist and still work.
8. **Spec-completeness cross-check against docs/MASTER_PROMPT.md and
   docs/PRD.md** (requirement-by-requirement, not phase-by-phase): found
   two data-model items from MASTER_PROMPT's "at minimum" table list that
   were never built — a standalone `SiteSetting` table and an `AuditLog`
   table (`Role` was deliberately not built as a separate table; that
   substitution is already recorded in docs/DECISIONS.md #12). Neither
   has a recorded docs/DECISIONS.md entry explaining the omission the way
   `Role` does. This is a genuine, honestly-flagged gap versus the
   original spec — see docs/RELEASE_SUMMARY.md's "Unimplemented
   requirements" section for the full assessment of what functionality
   substitutes for each (site-wide settings are currently a mix of
   environment variables and the `PortfolioTemplate`/`NavigationItem`
   tables; there is no audit trail of admin actions beyond the
   structured request logs). Per this phase's explicit "do not implement
   new features" scope, these were not built in this session — adding
   either is a schema change (new table + migration + admin UI + tests),
   which is feature work, not verification/hardening. Flagged here rather
   than silently omitted.
9. Stopped Gunicorn and the disposable PostgreSQL cluster cleanly.

## Not verified (and why)

**Headline gap, re-confirmed at the very end of Phase 9**: no Docker
daemon has ever been available in any session that built this
application, across all ten phases (0-9). `docker build`, `docker compose
up`, the hardened container settings (`read_only`, `cap_drop: [ALL]`,
`no-new-privileges`), the `migrate`/`proxy` profile-gated services, and
the Nginx reverse-proxy config have all been reviewed at the file/config
level only — never actually executed. Everything else in this
application (the Flask app itself, all migrations, the full test suite,
Gunicorn, and a real PostgreSQL 16 server) *has* been run for real,
repeatedly, throughout every phase, via the disposable-Postgres/no-Docker
technique documented below — Docker itself is the one piece of the stack
this sandbox has never been able to exercise directly.

**Before a real production deployment, a human should, on a
Docker-capable machine** (any machine with `docker`/`docker compose`
installed — a laptop is enough):
1. `git clone` this repository, `cp .env.example .env` and fill in a
   real `SECRET_KEY`/`ADMIN_BOOTSTRAP_EMAIL`/
   `ADMIN_BOOTSTRAP_PASSWORD_HASH` (generate the hash with
   `python -m venv .venv && source .venv/bin/activate && pip install -e
   ".[dev]" && flask hash-password`, or run it inside a throwaway
   container after step 2).
2. `docker build -t portfolio-app .` — confirm it completes and the
   resulting image runs as a non-root user (`docker run --rm
   portfolio-app id` should not print `uid=0`).
3. `docker compose up --build` — confirm `db` passes its healthcheck,
   `app` runs `flask db upgrade && flask bootstrap-admin` cleanly against
   the Compose Postgres service, and Gunicorn starts. `curl
   http://localhost:8000/healthz` and `/readyz` should both return 200.
4. Log in at `/auth/login` with the bootstrapped admin account and
   confirm the admin UI loads (this exercises the `read_only`/
   `cap_drop: [ALL]` container hardening against the app's actual runtime
   needs — e.g. that it can still write to the `media_uploads` volume and
   nowhere else).
5. `docker compose --profile proxy up --build` — confirm Nginx starts,
   `nginx -t`-equivalent config validation passes implicitly (the
   container fails fast on a bad config), and a request through Nginx to
   the app succeeds; if a real TLS certificate is available, confirm the
   HTTPS→app round-trip and that `ENABLE_HSTS=true` sends a
   `Strict-Transport-Security` header only over that HTTPS connection.
6. `docker compose run --rm migrate` — confirm the profile-gated
   one-shot migration service runs `flask db upgrade && flask
   bootstrap-admin` and exits 0, for anyone following the
   multi-instance migration procedure in docs/DEPLOYMENT.md.
7. Push to a branch and confirm `.github/workflows/ci.yml`'s
   `docker-build` and `dependency-audit` jobs (added in Phase 8, never
   run on GitHub Actions from this sandbox) go green on GitHub's own
   Docker-equipped runners.

None of the above is expected to fail — every Dockerfile/Compose/Nginx
change across all ten phases was reviewed manually and (for the YAML
files) parsed with PyYAML for syntax validity — but "reviewed" is not
"run," and CLAUDE.md's "never claim something works unless you ran the
relevant verification" rule means this must stay called out explicitly
rather than declared done.

- **`docker build`** — no Docker daemon available in this environment (no
  `docker` binary, no `dockerd`, no root to install one, no mounted
  `/var/run/docker.sock`). The Dockerfile was reviewed manually; its base
  image, multi-stage layout, non-root user, and CMD were exercised
  conceptually (the same dependency install and Gunicorn invocation were run
  successfully outside a container — see above) but the actual image build
  was not executed. **Action needed**: run `docker build -t portfolio-app .`
  and `docker compose up` on a machine with Docker available before treating
  this phase as fully closed.
- **Phase 8 container hardening (`read_only`, `cap_drop: [ALL]`,
  `no-new-privileges`, the `media_uploads` volume, the `migrate`/`proxy`
  profile-gated services)** — same no-Docker-daemon constraint. These were
  reviewed manually and `docker-compose.yml` was confirmed to parse as
  valid YAML (including the new `&app_environment` anchor/`*app_environment`
  alias reuse between `app` and `migrate`), but never actually started as
  containers. In particular, `read_only: true` combined with `cap_drop:
  [ALL]` has not been confirmed to leave the app fully functional inside an
  actual container (only that the equivalent read/write behavior — the app
  writing nothing outside `instance/uploads`/`/tmp` — was true when run
  directly under Gunicorn outside a container, per the Phase 7/8 live
  verification runs). **Action needed**: `docker compose up --build` (and,
  separately, `docker compose --profile proxy up --build` /
  `docker compose run --rm migrate`) on a machine with Docker available.
- **`deploy/nginx/portfolio.conf` / the `proxy` Compose service** — never
  run against an actual Nginx process or a real TLS handshake (no Docker
  daemon, and no domain/certificate available in this environment to
  terminate TLS for). The app-side half of the contract (correctly reading
  `X-Forwarded-Proto`/emitting HSTS once `TRUST_PROXY_HEADERS=true`) *was*
  live-verified by manually setting the same headers curl would receive
  from a real Nginx — see the Phase 8 session above — but Nginx's own
  config syntax was only reviewed, never parsed by `nginx -t` or an actual
  `nginx` binary (none available in this environment).
- **CI workflow itself** — `.github/workflows/ci.yml` has not run on GitHub
  Actions (no push made in this session). Its individual steps (ruff, black,
  mypy, `flask db upgrade`, pytest) were each run locally/against a real
  Postgres and passed; the workflow YAML mirrors those exact commands. It
  was not modified in Phase 1 (no new steps were needed — the existing
  `flask db upgrade` + `pytest` steps already cover the new migration and
  tests). Phase 8 added two new jobs — `dependency-audit` (`pip-audit`,
  `continue-on-error: true`) and `docker-build` (`docker build --target
  runtime`) — and fixed a pre-existing YAML-quoting bug in the `test`
  job's `env` block that PyYAML rejected outright (see docs/DECISIONS.md
  #57); `pip-audit` itself was run directly in this session (not via the
  new CI job, which — like the rest of the workflow — has not executed
  on GitHub Actions), and the `docker-build` job's actual build has not
  run anywhere (no Docker daemon in this environment; it will run for
  real on GitHub Actions' own Docker-equipped runners on the next push).
- **Multi-worker/multi-instance rate limiting** — the login rate limiter
  uses Flask-Limiter's in-process `memory://` storage (docs/DECISIONS.md
  #14), which is correct for this app's single-instance deployment target
  but was only exercised with Gunicorn's default single worker in this
  session's manual curl testing (the automated test uses the Flask test
  client, effectively one process too). If a future deployment runs
  multiple Gunicorn workers/instances, each would have its own independent
  counter — acceptable for now (rate limiting is defense-in-depth, not the
  sole brute-force control — Argon2id hashing is deliberately slow), but
  worth revisiting if this app is ever horizontally scaled.
- **`SESSION_PROTECTION = "strong"` under a real reverse proxy** — this was
  exercised via the Flask test client and direct Gunicorn access (no
  proxy in front), where the remote address is stable. Behavior behind a
  reverse proxy that doesn't forward a consistent client IP (e.g.
  `ProxyFix` not configured) was not tested; Phase 8 ("production
  hardening") is the natural place to verify this once Nginx is actually
  in the deployment path.
- **`docker build`/`docker compose up` including the new `bootstrap-admin`
  step** — same Docker-unavailable constraint as Phase 0 (see above); the
  updated `docker-compose.yml` command
  (`flask db upgrade && flask bootstrap-admin && gunicorn ...`) was
  reviewed manually and each of its three commands was run individually
  and successfully outside a container, but the composed command string
  itself was not executed inside an actual container. `docker-compose.yml`
  itself needed no changes in Phase 2 (it already runs `flask db upgrade`
  on every start, which now also applies the new Phase 2 migration).
- **Multiple concurrent admin accounts** — this application still seeds
  exactly one administrator (Phase 1 scope). `Profile.user_id` is unique,
  so the data model already supports a second admin having their own
  separate `Profile`/content tree without a migration, but that path was
  not exercised (no multi-admin creation UI exists yet, and `SkillCategory`
  is deliberately a shared/global taxonomy across whichever admins exist —
  see docs/DECISIONS.md #18).
- **HTMX drag-and-drop reordering** — the stack includes HTMX, but Phase 2's
  reordering UI uses plain "move up"/"move down" POST buttons instead (see
  docs/DECISIONS.md #21) for keyboard/screen-reader accessibility without
  extra JS; the service layer's `reorder_scoped()` (arbitrary explicit
  order from a list of ids) is implemented and tested, so a future
  HTMX-driven drag handle can call it directly with no model/service
  changes — only a new route + JS is needed.
- **Bootstrap 5 loaded from a CDN, not vendored** — `themes/_layout.html`
  links `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/...`. This was only
  exercised via the Flask test client (no network access required — the
  test client never actually fetches the linked stylesheet) and via
  Gunicorn/curl (which only fetches the HTML document, not the externally-
  linked CSS). Whether that CDN is reachable from wherever this app is
  actually deployed was not verified in this sandbox (no outbound network
  access here); a fully offline/air-gapped deployment would need Bootstrap
  vendored locally instead — worth revisiting in Phase 4/8 once real public
  pages depend on it rendering correctly in an actual browser.
- **No real browser was used** — every "renders correctly"/"dark-light
  toggle works" check in this phase is at the HTML-string level (pytest)
  or the HTTP-response level (curl). No headless-browser/visual check
  confirmed the CSS actually paints as intended or that
  `static/js/theme-toggle.js` actually executes and flips
  `data-bs-theme` in a live DOM. Worth a manual/Playwright pass once Phase
  4 builds real public pages people will actually look at.
- **`docker build`/`docker compose up` for Phase 5** — same Docker-
  unavailable constraint as every prior phase; the new `markdown`/`bleach`
  dependencies were installed and exercised successfully outside a
  container (see above), but the actual image build (which would need to
  pick these up via `pyproject.toml`) was not executed in this session.
- **No real browser was used for the blog pages either** — every
  "sanitized"/"renders correctly"/"SEO tag present" check in this phase is
  at the HTML-string (pytest) or HTTP-response (curl) level, same
  limitation as Phases 3-4. No headless-browser check confirmed Pygments'
  syntax-highlighting CSS actually paints as intended, or that OpenGraph/
  Twitter card tags render a correct preview in an actual social-media
  crawler/browser.
- **Pygments' generated CSS was captured once, not regenerated by a build
  step** — `app/static/css/pygments.css` was generated by running
  `HtmlFormatter().get_style_defs('.codehilite')` once during this session
  and committed as a static file (like any other theme CSS file in this
  app), rather than generated at request/build time. If Pygments' default
  style ever needs to change, this file needs to be regenerated manually -
  worth a comment/task for whoever changes syntax-highlighting themes
  later.
- **`docker build`/`docker compose up` for Phase 6** — same Docker-
  unavailable constraint as every prior phase; no new dependency was added
  in this phase (RSS/sitemap/robots.txt use only the Python standard
  library's `xml.sax.saxutils`), so the existing image build is unaffected,
  but the actual image build was still not executed in this session.
- **No real social-media crawler/browser validated the OpenGraph/Twitter
  Card previews** — `og:title`/`og:description`/`og:image`/`twitter:card`
  presence and correctness were verified at the HTML-string (pytest) and
  HTTP-response (curl) level only. No Facebook/Twitter/LinkedIn card
  debugger or headless browser confirmed an actual rendered preview card.
- **No real RSS reader consumed `/rss.xml`** — validated via
  `xml.etree.ElementTree` (well-formed XML) and direct field assertions,
  not by pointing an actual feed reader (e.g. Feedly, NetNewsWire) at the
  live URL.
- **No real search-engine crawler/Search Console validated `/sitemap.xml`
  or `robots.txt`** — validated by parsing the XML and asserting expected/
  excluded URLs directly, not via Google Search Console's sitemap
  submission/validation tooling or an actual crawler run.
- **`docker build`/`docker compose up` for Phase 7** — same Docker-
  unavailable constraint as every prior phase; the two new dependencies
  this phase's `MediaUploadForm` needed (`flask_wtf.file`'s `FileField`/
  `FileAllowed`/`FileRequired`) ship inside the already-installed
  `flask-wtf` package (no new `pyproject.toml` dependency was added), so
  the existing image build is unaffected in principle, but the actual
  image build was still not executed in this session.
- **`SMTPEmailAdapter` was never exercised against a real SMTP server** —
  per this phase's own instructions ("at least construct correct messages
  without real network"), it was verified with a mocked `smtplib.SMTP`
  (`tests/test_email_adapter.py`) asserting the constructed
  From/To/Subject/Reply-To/body and that `starttls()`/`login()` are called
  only when configured to. No real mail server (a local `smtpd`/MailHog/an
  actual provider) received a message in this session - worth doing once a
  production mail provider is actually chosen (Phase 8+).
- **Multi-worker rate-limiter behavior was observed, not just asserted** —
  this phase's curl session ran Gunicorn with 2 workers and confirmed
  `CONTACT_RATE_LIMIT` still triggers a `429` (the in-process `memory://`
  counter is per-worker, so the exact request count at which `429` first
  appears varies run-to-run with >1 worker - already a known, accepted
  characteristic of this backend per docs/DECISIONS.md #14, not new to
  Phase 7). Still not tested against a real multi-*instance* deployment
  (e.g. two separate containers behind a load balancer) - `RATELIMIT_
  STORAGE_URI` would need to point at Redis for that, per #14's own
  documented upgrade path.
- **No malicious-image-with-valid-magic-bytes (polyglot file) test** — the
  content-sniffing check in `app/services/media_service.py` validates the
  first several bytes match a known image signature; it does not scan the
  rest of the file for embedded/appended malicious payloads (e.g. a
  polyglot GIF/PHP file, image files with malformed metadata designed to
  exploit a downstream image-processing library). This app never processes
  uploaded images beyond storing/serving the raw bytes (no thumbnailing/
  re-encoding/EXIF-stripping in this phase), which limits the blast radius
  of such a file, but a dedicated deeper-inspection library (e.g. a real
  image-decode-and-re-encode step) was not added - worth considering in a
  hardening phase if uploaded images are ever processed server-side.

## Known limitations / deferred to later phases
- Contact backend and media/upload are now implemented (Phase 7 - see
  above); this bullet is retained for history. The full public portfolio
  site exists (Phase 4) plus a search-engine-discoverable blog
  (Phases 5-6) plus a working contact form and media uploads (Phase 7):
  Home, About, Experience, Education, Skills, Projects (list + detail),
  Certifications, Achievements, Resume, a working Contact page/form
  (persisted + admin-triaged + rate-limited + honeypot-protected), and
  Blog (list, detail, category, tag, search - all paginated) plus
  `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/media/<stored_name>`.
- Pagination (Phase 6) is in-memory (`app/common/pagination.py` slices an
  already visibility-filtered Python list) rather than a SQL-level
  `LIMIT/OFFSET` query — a deliberate scale-appropriate tradeoff (see that
  module's docstring and docs/DECISIONS.md); would need revisiting only if
  this blog's post count grows large enough that fetching the full
  visible-post list on every request becomes measurably slow.
- Search (Phase 6) is a simple `ILIKE` substring match across
  title/excerpt/body, not a dedicated search engine/full-text index — per
  docs/MASTER_PROMPT.md's "no external API dependency for core
  functionality" and this app's scale; see docs/DECISIONS.md.
- `BlogPost.rendered_body` is computed synchronously at save time (in the
  same request as the admin's create/edit POST) rather than by a background
  task — acceptable given `markdown`+`bleach` run in low-single-digit
  milliseconds for realistic post lengths and this app's single-admin,
  low-write-volume usage pattern; worth revisiting only if posts become
  extremely large or rendering becomes measurably slow.
- `BlogPost.author_id` is nullable with `ON DELETE SET NULL` - if the sole
  admin account is ever deleted, their existing posts remain (orphaned
  author) rather than being deleted or blocking the account deletion. No
  UI currently deletes the admin account, so this path is unexercised in
  practice; documented per CLAUDE.md's "do not silently delete or overwrite
  user content."
- The public site's Phase 4 "SEO foundations" are intentionally minimal:
  a per-page `<title>` and `<meta name="description">`, nothing else.
  No canonical URLs, OpenGraph/Twitter card metadata, `robots.txt`,
  sitemap, or structured data — that is explicitly Phase 6 scope.
- Public pages are one shared Jinja template per page (not five per-theme
  variants) — see docs/DECISIONS.md for why. This means each theme's
  visual identity on these pages comes entirely from its stylesheet
  (`app/static/css/themes/<key>.css`) and the shared layout/macros, not
  from theme-specific page markup/structure choices (Phase 3's `preview.
  html` files, by contrast, each still have a small theme-specific
  structural wrapper - e.g. minimal's terminal-prompt framing - and remain
  unchanged, admin-only, and unused by the public site).
- The contact page's form is now fully functional (Phase 7 - server-side
  validation, CSRF, rate limiting, honeypot, persistence, best-effort email
  notification). This bullet is retained for history; see the Phase 7
  section above.
- `Resume` delivery is still URL-only (`Resume.public_url`, opened in a new
  tab) — Phase 7 added local file upload/serving (`/admin/media`,
  `/media/<stored_name>`) as a general-purpose endpoint rather than wiring
  it directly into the Resume form/`Resume.storage_reference` field (see
  docs/DECISIONS.md for why this integration point was chosen); an admin
  can upload a file at `/admin/media` and paste its URL into `Resume.
  public_url` today, but `Resume.storage_reference`/the resume-specific
  upload UI remain unused. A future pass could wire the upload widget
  directly into the Resume/Project/BlogPost forms if that UX is wanted -
  no model/service/adapter change would be needed, only new form/template
  wiring.
- No real browser/visual/Lighthouse check was run against the public site
  in this phase either (same limitation Phase 3 noted for the admin
  preview) — every accessibility/rendering assertion here is at the
  HTML-string (pytest) or HTTP-response (curl) level. Worth a manual or
  automated (axe-core/Lighthouse) pass in a later hardening phase.
- `PortfolioTemplate.is_active`'s "exactly one active row" invariant is
  enforced only in the service layer (`template_service.set_active_
  template`'s single-transaction deactivate-all-then-activate-target), not
  by a DB constraint — see docs/DECISIONS.md #24. A direct/manual DB write
  bypassing the service layer could violate it; no other code path in this
  application does that today.
- `PortfolioTemplate.is_active`'s "exactly one active row" invariant is
  enforced only in the service layer (`template_service.set_active_
  template`'s single-transaction deactivate-all-then-activate-target), not
  by a DB constraint — see docs/DECISIONS.md #24. A direct/manual DB write
  bypassing the service layer could violate it; no other code path in this
  application does that today.
- The admin CRUD UI is intentionally plain/unstyled (two generic, shared
  Jinja templates rather than a styled Bootstrap 5 admin dashboard with a
  sidebar/breadcrumbs/cards per docs/UI_DESIGN.md) — functional, accessible
  (labeled fields, semantic `<table>`/`<nav>`, keyboard-operable
  move/delete), and correct, but the visual polish pass is explicitly later
  scope per the task's own instructions for this phase.
- `ProjectTechnology` has no standalone admin CRUD screen — it's managed as
  a single ordered comma-separated field on the Project form
  (`project_service.sync_technologies`), which still produces normalized,
  individually-ordered rows per docs/DATABASE_DESIGN.md. See
  docs/DECISIONS.md #20.
- No password-reset flow, no "change my own password" self-service, no
  rehash-on-login-if-Argon2-parameters-changed — none required by Phase 1's
  scope (single bootstrap-seeded admin account); worth adding once there is
  an admin UI to host them.
- `next`-based post-login redirect is not implemented (login always goes to
  `admin.dashboard` regardless of what page originally redirected to
  `/auth/login`) — a deliberate simplicity/safety tradeoff, see
  docs/DECISIONS.md #16.
- No pre-commit config yet (CLAUDE.md lists pre-commit under "Quality");
  Ruff/Black/mypy are wired into CI and runnable locally but not yet as git
  hooks. Can be added in a later phase without affecting exit criteria.
- No coverage threshold is enforced yet (`pytest-cov` is installed and CI
  reports coverage, but nothing fails the build on a specific percentage) —
  reasonable until there is meaningful application code to cover.
- Media uploads are not wired into any specific `*_url` form field
  (blog cover image, project image, profile photo, resume) - `/admin/media`
  is a standalone general-purpose upload-and-copy-the-URL page. See
  docs/DECISIONS.md for why this was the least invasive integration point.
- `MediaAsset` rows and their underlying files can go out of sync with
  where they're actually *used* - deleting an image at `/admin/media` does
  not know or check whether some `Project.image_url`/`BlogPost.
  cover_image_url`/etc. still references its `/media/<stored_name>` URL
  (there is no reverse-reference tracking). Deleting a still-referenced
  image would leave a broken image link on the page that referenced it,
  the same failure mode as an admin editing/removing any other `*_url`
  field's target out from under a page today - not a new risk class this
  phase introduced, but worth a "used by" check in a later phase if this
  becomes a real operational annoyance.
- Only local filesystem storage is implemented (`STORAGE_PROVIDER=local`);
  `STORAGE_PROVIDER=s3` (or any other value) currently falls back to local
  with a warning log rather than actually talking to S3 - the
  `StorageAdapter` interface (app/common/storage.py) is designed so a real
  S3-compatible adapter can be added as a new class with no caller changes,
  but that adapter itself was not built in this phase (not required by
  CLAUDE.md's "for the initial release" framing).
- The honeypot is the only spam defense beyond rate limiting - no CAPTCHA,
  no third-party spam-scoring API, per this phase's explicit instruction
  ("do not add a CAPTCHA dependency"). A determined, form-aware bot that
  fills every field including the honeypot would not be caught by this
  mechanism alone; rate limiting (`CONTACT_RATE_LIMIT`) is the backstop for
  that case. See docs/DECISIONS.md.
- `ContactMessage`/`MediaAsset` have no admin bulk actions (bulk-delete,
  bulk-archive) - only per-row actions. Acceptable at this app's expected
  single-admin, low-volume scale; worth adding if message/upload volume
  grows.
- **No `SiteSetting` table and no `AuditLog` table** — both are listed in
  docs/MASTER_PROMPT.md's "at minimum" data-model table, and neither was
  built in any phase (found during the Phase 9 spec-completeness
  cross-check; see that session's write-up above). `Role` from the same
  list *was* deliberately handled differently — a plain checked column on
  `User` rather than a table, an explicit, recorded tradeoff
  (docs/DECISIONS.md #12) — but `SiteSetting`/`AuditLog` have no such
  recorded decision; they are simply missing. What exists instead: global,
  non-content site configuration is split between environment variables
  (`app/config.py` - `BASE_URL`, mail/storage/rate-limit settings, etc.,
  which do satisfy CLAUDE.md's "environment variables for
  deployment-specific configuration" rule) and two narrow DB-backed
  registries that each cover one specific setting
  (`PortfolioTemplate.is_active` for the active theme,
  `NavigationItem` for nav configuration) - there is no general-purpose
  admin-editable key/value site-settings table for anything else (e.g. a
  site title/tagline separate from `Profile`, a maintenance-mode flag).
  Similarly, there is no audit trail of admin actions (who changed what,
  when) beyond the structured request/response logs
  (`app/common/logging.py`) and each mutating request's `request_id` -
  which record *that* a request happened, not a queryable
  before/after change history. Neither omission is a security hole (every
  admin mutation is still authorization-checked and CSRF-protected; the
  gap is in configurability/traceability, not access control), but both
  are genuine unimplemented spec items, not a substitution the way `Role`
  was. Adding either is schema-changing feature work (new table +
  migration + service + admin UI + tests) and was deliberately not done
  in Phase 9, which is verification/hardening-scoped only - see
  docs/RELEASE_SUMMARY.md for the full assessment.
