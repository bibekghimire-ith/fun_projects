# Release Summary — Personal Portfolio + Blog Platform

Status: **release candidate**. All ten phases in docs/IMPLEMENTATION_PLAN.md
(0 — Foundation through 9 — Final verification) are complete. This document
is the final response required by docs/MASTER_PROMPT.md's "Final response"
section. It is honest about what was and was not verified — see "Known
limitations" and "Unimplemented requirements" below before deploying to
real production traffic.

## 1. Implemented features

**Public portfolio** (all unauthenticated, all rendered through whichever
theme is active): Home, About, Experience, Education, Skills, Projects
(list + detail), Certifications, Achievements, Resume, Blog (list, detail,
category, tag, search — all paginated), Contact (working form), a themed
404, `/rss.xml`, `/sitemap.xml`, `/robots.txt`. Navigation is
admin-configurable (which pages appear, in what order).

**Admin CMS** (all behind `@admin_required` — session-authenticated,
server-side `is_admin` re-checked on every request): dashboard; Profile
editor; Social Links, Experience, Education, Certifications, Achievements
CRUD + reordering; Projects CRUD + reordering (with an ordered technology
list); Skill Categories + nested Skills CRUD + reordering; Resume metadata
editor; Navigation CRUD + reordering; template/theme selection + live
preview; Blog post CRUD (Markdown body, excerpt, cover image URL,
category, tags, SEO title/description, canonical URL, featured flag, slug
management), draft/publish/unpublish/schedule as explicit actions, inline
and full-page sanitized preview; Blog category/tag CRUD; contact message
triage (list/filter/view/mark read-archived/delete); media upload +
library.

**Template engine**: five built-in themes — Minimal Developer, Modern
Professional, Cybersecurity/Engineering, Academic/Research, Creative — as
a code-level registry (`app/templates_engine/registry.py`) mirrored into a
DB-backed `portfolio_templates` table tracking which one is active.
Switching the active template is exactly one UPDATE statement; it never
touches Profile/Experience/Project/etc. rows (verified directly by a
dedicated test and by the Phase 9 smoke test's HTML-diff check across
three themes with the same profile name present in all of them). All five
themes share one Jinja macro layer over the same content models — no
theme duplicates portfolio data. Dark/light mode works across all five via
a `data-bs-theme`-toggling script with `localStorage` persistence and a
pre-paint inline script to avoid a flash of the wrong mode.

**Blog/CMS**: Markdown authoring (`markdown` library, `codehilite`/
`fenced_code`/`tables` extensions) always passed through `bleach.clean()`
against an explicit allowlist before storage (`BlogPost.rendered_body`) —
there is no code path that renders `markdown_body` as unsanitized HTML.
Scheduling is a pure computed-visibility abstraction
(`BlogPost.is_publicly_visible(now)`), not a background worker. Public
discovery: pagination, `ILIKE` search, category/tag pages, related posts
(shared-tag/category heuristic), reading-time estimates, RSS 2.0,
sitemap, robots.txt, OpenGraph/Twitter Card metadata with an image
fallback chain.

**Auth**: Argon2id password hashing, session-fixation-safe login (session
cleared before `login_user()`), `session_protection="strong"`, CSRF via a
global `CSRFProtect`, login rate limiting (`LOGIN_RATE_LIMIT`), a single
bootstrap-seeded admin account (`flask bootstrap-admin`, idempotent, no
public registration route), secure cookie configuration.

**Contact**: server-side validated (`FlaskForm`), CSRF-protected,
rate-limited (`CONTACT_RATE_LIMIT`, confirmed to return 429 under burst),
honeypot-protected (silently dropped, no error signal to the bot), always
persisted to `contact_messages` regardless of mail configuration, with a
best-effort notification through a swappable `EmailAdapter`
(console/log by default, SMTP opt-in) that never raises into the request
and never exposes credentials/admin email in a response.

**Media**: general-purpose upload endpoint (`/admin/media`, admin-only)
that validates uploads by sniffing actual file bytes (magic numbers), not
filename/Content-Type; enforces a size limit and an image-only allowlist;
stores under safe randomized names via a swappable `StorageAdapter`
(local filesystem implemented; S3-compatible is a documented future
extension point, not built); serves back at `/media/<stored_name>` with
traversal-proof lookup.

**Production hardening**: CSP/X-Content-Type-Options/X-Frame-Options/
Referrer-Policy/Permissions-Policy on every response, opt-in HSTS,
`ProxyFix` for a trusted reverse proxy, a hardened
Dockerfile/docker-compose.yml (non-root, read-only root filesystem,
dropped capabilities, `no-new-privileges`, a dedicated uploads volume), a
profile-gated one-shot `migrate` service and profile-gated Nginx `proxy`
service, `pip-audit` run with findings documented, structured JSON logging
with per-request IDs, `/healthz`/`/readyz`, documented backup/restore and
migration procedures.

## 2. Architecture

Flask application factory (`app/__init__.py`, `create_app()`), no
module-level Flask instance. Domain-organized package layout: `auth/`,
`admin/`, `public/`, `blog/` (blueprint stub — blog routes live under
`public/`), `contact/` (stub — contact route lives under `public/`),
`templates_engine/`, `seo/` (RSS/sitemap/robots), `models/`, `services/`
(business logic — routes stay thin), `repositories/` (present, unused
beyond the ORM itself — no repository layer was needed at this scale),
`common/` (logging, health, security headers, email/storage adapters,
pagination). SQLAlchemy 2.0 ORM + Flask-Migrate/Alembic for every schema
change. Jinja2 server-rendered templates throughout — no SPA. A shared
`themes/_layout.html` skeleton plus `base/_content_components.html`
macros are the single source of presentation for both the admin-preview
and public-site render paths; every public page is one template shared
across all five themes, with only the active theme's CSS custom
properties differing.

## 3. Important design decisions

Full history with rationale for every ambiguous requirement is in
docs/DECISIONS.md (~57 entries). The ones with the broadest structural
impact:
- `Role` is a checked column on `User`, not a normalized table (#12) —
  the one MASTER_PROMPT "at minimum" table deliberately not built, with a
  recorded reason. (`SiteSetting`/`AuditLog` were *not* deliberately
  substituted — see "Unimplemented requirements" below.)
- IDOR defense is structural: every scoped entity fetch goes through
  `get_scoped(id, scope)` (`app/services/portfolio_content.py`), returning
  `None` → 404 on any mismatch, so a wrong-owner id and a nonexistent id
  are indistinguishable to an attacker.
- Ordering uses dense integers reassigned on every create/move (no
  renumbering job needed); reordering UI is "move up"/"move down" buttons
  (keyboard/screen-reader operable), not drag-and-drop, despite HTMX being
  in the stack (#21) — the service-layer `reorder_scoped()` exists for a
  future HTMX UI to call.
- Template switching is a one-row UPDATE on `portfolio_templates`,
  enforced never to touch content tables — the core Phase 3 exit
  criterion.
- Blog scheduling has no background worker; visibility is a pure function
  of `status` + timestamp compared against `now`, evaluated at query time.
- Sanitize-on-save, not sanitize-on-render: `BlogPost.rendered_body` is
  computed once at save time so every read is a plain, pre-sanitized
  string with no per-request Markdown/bleach cost and no code path that
  could accidentally skip sanitization.
- Media/mail are both behind an adapter interface
  (`StorageAdapter`/`EmailAdapter`) so a real backend (S3, SMTP-in-anger)
  is a new class, not a caller change.
- Rate limiting uses Flask-Limiter's in-process `memory://` store by
  default — correct for this app's single-instance target, with
  `RATELIMIT_STORAGE_URI` documented as the Redis upgrade path for a
  scaled deployment (#14).
- CSP ships with no `'unsafe-inline'` — the one inline script became a
  static file, and admin-UI inline `onclick`/`onsubmit`/`style` attributes
  were replaced with small utility CSS/JS.

## 4. Database summary

19 model-backed tables plus one many-to-many association table, all via
Flask-Migrate/Alembic (seven migrations, `1279f3ba16bf` foundation
baseline through `2cc96082b855`):

| Table | Purpose |
|---|---|
| `users` | The single admin account (UUID PK, unique email, Argon2id hash, `role` CHECK constraint, `is_active`, `last_login_at`) |
| `profiles` | 1:1 with `users` — display name, title, tagline, bio, avatar, location, availability, public email |
| `social_links` | Profile-scoped, ordered |
| `experiences` | Profile-scoped, ordered |
| `educations` | Profile-scoped, ordered |
| `skill_categories` | Global taxonomy, ordered |
| `skills` | Category-scoped, ordered, proficiency 1–5 CHECK |
| `projects` | Profile-scoped, ordered, unique slug |
| `project_technologies` | Project-scoped, ordered |
| `certifications` | Profile-scoped, ordered |
| `achievements` | Profile-scoped, ordered |
| `resumes` | 1:1 singleton — public URL, download flag |
| `portfolio_templates` | Registry mirror — which themes exist, which is active |
| `navigation_items` | Global, ordered — endpoint name + label + visibility |
| `blog_categories` | Global taxonomy |
| `blog_tags` | Global taxonomy |
| `blog_posts` | Title, slug, excerpt, `markdown_body`, `rendered_body` (sanitized), status CHECK (draft/published/scheduled), `published_at`/`scheduled_at`, SEO fields, `author_id` FK (`ON DELETE SET NULL`) |
| `blog_post_tags` | Many-to-many association, composite PK, `ON DELETE CASCADE` both directions |
| `contact_messages` | Name/email/subject/message, status CHECK (new/read/archived), `ip_address` |
| `media_assets` | Upload audit trail — original filename, stored name (unique), content type, size, uploader FK |

Every child table with a `Profile` scope cascades on delete
(`ON DELETE CASCADE`); every "who did this" FK (`BlogPost.author_id`,
`MediaAsset.uploaded_by_id`) is `ON DELETE SET NULL` so deleting the admin
account never silently deletes their content. All UUID primary keys via a
dialect-independent `GUID` type; all timestamps UTC-aware via a shared
`TimestampMixin`.

**Not built**: `SiteSetting` and `AuditLog`, both listed in
docs/MASTER_PROMPT.md's "at minimum" table list — see "Unimplemented
requirements" below.

## 5. Environment variables

Every variable `app/config.py` reads, grouped as in `.env.example`
(kept in sync — verified in Phase 9):

| Variable | Purpose | Default |
|---|---|---|
| `APP_ENV` | `development` \| `testing` \| `production` | `development` |
| `SECRET_KEY` | Flask session/CSRF signing key | dev placeholder; **required** in production (raises `RuntimeError` if unset) |
| `BASE_URL` | Public base URL for absolute links, sitemap, RSS | `http://localhost:5000` |
| `LOG_LEVEL` | Structured logging level | `INFO` |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+psycopg://...`) | SQLite fallback in dev/test; **required** in production |
| `SESSION_COOKIE_SECURE` | Require HTTPS for the session cookie | `false` (dev) |
| `SESSION_LIFETIME_MINUTES` | Session cookie lifetime | `720` |
| `ENABLE_HSTS` | Send `Strict-Transport-Security` | `false` (`true` default in production) |
| `HSTS_MAX_AGE` | HSTS max-age seconds | `63072000` |
| `TRUST_PROXY_HEADERS` | Apply `ProxyFix` for `X-Forwarded-*` | `false` |
| `PROXY_COUNT` | Reverse-proxy hop count to trust | `1` |
| `ADMIN_BOOTSTRAP_EMAIL` | First-admin email | `admin@example.com` |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | Pre-hashed bootstrap password (preferred) | empty |
| `ADMIN_BOOTSTRAP_PASSWORD` | Plaintext bootstrap password (dev convenience only) | empty |
| `LOGIN_RATE_LIMIT` | Flask-Limiter rule for `/auth/login` | `5 per minute;20 per hour` |
| `MAIL_PROVIDER` | `console` \| `smtp` | `console` |
| `MAIL_SMTP_HOST`/`PORT`/`USERNAME`/`PASSWORD`/`USE_TLS`/`MAIL_DEFAULT_SENDER` | SMTP adapter config | empty / `587` / empty / empty / `true` / empty |
| `STORAGE_PROVIDER` | `local` (`s3` falls back to local with a warning) | `local` |
| `STORAGE_LOCAL_DIRECTORY` | Local upload directory | `instance/uploads` |
| `MEDIA_MAX_UPLOAD_BYTES` | Max upload size | `5242880` (5 MB) |
| `CONTACT_NOTIFY_EMAIL` | Notification recipient (blank = no notification, message still saved) | empty |
| `RATELIMIT_STORAGE_URI` | Flask-Limiter backend (`redis://...` for multi-instance) | `memory://` |
| `RATELIMIT_DEFAULT` | Global default limit | `200 per hour` |
| `CONTACT_RATE_LIMIT` | `/contact` limit | `5 per hour;20 per day` |
| `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` | Compose-only — consumed by the `postgres` image, not by the app | `portfolio` / `portfolio` / `portfolio` |

`TEST_DATABASE_URL` also exists (test-only override, not meant for
`.env.example`).

## 6. Commands to run locally

```
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
flask db upgrade
flask bootstrap-admin        # or: flask hash-password, then set ADMIN_BOOTSTRAP_PASSWORD_HASH
flask run
```

```
pytest --cov=app --cov-report=term-missing
ruff check .
black --check .
mypy app
```

## 7. Docker deployment instructions

```
cp .env.example .env    # set SECRET_KEY, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD_HASH
docker build -t portfolio-app .
docker compose up --build
```
`app` runs `flask db upgrade && flask bootstrap-admin && exec gunicorn
-c gunicorn.conf.py wsgi:app` on boot — correct for the default
single-instance deployment. For a scaled/multi-instance deployment, use
the profile-gated one-shot migration service instead
(`docker compose run --rm migrate`) and strip the migration step from
`app`'s command — see docs/DEPLOYMENT.md's "Migration procedure" section
for the full rationale and steps. An optional Nginx reverse proxy
(TLS termination, `X-Forwarded-*` forwarding) is available via
`docker compose --profile proxy up --build` using
`deploy/nginx/portfolio.conf`; once it is the sole entry point, set
`TRUST_PROXY_HEADERS=true` so the app sees the real client IP/scheme.
See docs/BACKUPS.md for the `pg_dump`/`pg_restore` and media-directory
backup procedure.

**Docker itself was not executed in this build environment — see
"Known limitations" below before relying on any of the above without
running it yourself first.**

## 8. Test / lint / coverage results (this session, Phase 9)

- `pytest --cov=app`: **428 passed**, 0 failed.
- Coverage: **91%** (2560 statements, 228 missed — concentrated in thin
  service-layer wrappers exercised through route-level tests rather than
  unit tests; no untested route/behavior).
- `ruff check .`: all checks passed.
- `black --check .`: 101 files unchanged.
- `mypy app`: no issues found in 65 source files.
- Migration from empty DB: verified against both a fresh SQLite database
  (full upgrade/downgrade/re-upgrade round-trip) and a freshly-built
  disposable PostgreSQL 16 server (all seven migrations applied with no
  errors; `flask db migrate` reported no drift afterward).
- Comprehensive smoke test (real Gunicorn + real PostgreSQL 16, the full
  user journey — bootstrap, login, content CRUD, theme switching, blog
  publish + sanitization + RSS/sitemap, contact CSRF/honeypot/rate-limit,
  media validation, security headers, admin-route lockout before login
  and after logout): **41/41 assertions passed** on the final run (an
  initial run surfaced 7 failures, all subsequently diagnosed as bugs in
  the smoke-test script itself, not the application — see
  docs/IMPLEMENTATION_STATE.md's Phase 9 session for the full
  investigation of each one).
- `docker build`/`docker compose up`: **not run** — no Docker daemon
  available in this environment (see below).

## 9. Security verification summary

- Argon2id password hashing; generic authentication failure messages;
  dummy-hash verification on unknown email to reduce timing-based email
  enumeration.
- CSRF via a global `CSRFProtect` on every `FlaskForm`; confirmed live
  that a token-less POST to `/auth/login` and `/contact` both return 400.
- Session-fixation mitigation (session cleared before `login_user()`),
  `session_protection="strong"`.
- Authorization: every one of the 52 admin routes carries
  `@admin_required` (auth + server-side `is_admin` re-check on every
  request, confirmed by a script-driven audit of `app/admin/routes.py` in
  this session) — confirmed live that all nine representative admin
  routes return a login redirect both before login and again after
  logout.
- IDOR: every scoped entity fetch returns 404 (never a leaking 403) on a
  wrong-owner or nonexistent id.
- XSS: blog Markdown is always passed through `bleach.clean()` before
  storage; the only `|safe`/`Markup` usages in the codebase are confined
  to that pre-sanitized output — confirmed live in this session that a
  `<script>` tag submitted in a blog post's Markdown body does not appear
  in the rendered page, while legitimate Markdown (`**bold**`) does render
  as `<strong>`.
- SQL injection: SQLAlchemy ORM throughout; no raw string-interpolated
  SQL anywhere in the codebase (re-grepped in this session).
- Open redirects: none — the login route never reads a `next` parameter.
- Rate limiting: login and contact both rate-limited; confirmed live in
  this session that a burst of contact submissions from one IP returns
  429.
- Uploaded-file validation: content-sniffed by magic bytes, not
  filename/Content-Type; confirmed live that a `.png`-named,
  `image/png`-typed file with non-image bytes is rejected while a real
  PNG is accepted.
- Secrets: no hardcoded secrets found (re-grepped in this session); mail/
  DB/session secrets are environment-variable-only; `DEBUG` is `True`
  only in `DevelopmentConfig`, explicitly `False` in `ProductionConfig`.
- Security headers (CSP with no `'unsafe-inline'`, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy, opt-in HSTS)
  confirmed present on a live response in this session.
- `pip-audit` (Phase 8): two findings, both in dev-only tooling
  (`black`, `pytest`) that never ships in the production image, accepted
  as risk with no patch available in the pinned major-version line — see
  docs/DECISIONS.md #57. Not re-run in Phase 9 (no dependency changes
  since Phase 8).

## 10. Known limitations

- **No Docker daemon has been available in any session across all ten
  phases** — `docker build`/`docker compose up`/the hardened container
  settings/the Nginx proxy service have been reviewed at the config
  level (including YAML-validated with PyYAML) but never executed. This
  is the single biggest gap before real production deployment. See
  docs/IMPLEMENTATION_STATE.md's "Not verified" section for a step-by-step
  checklist a human should run on any Docker-capable machine before
  trusting this in production.
- Rate limiting uses an in-process store (`memory://`) — correct for a
  single-instance deployment, not multi-instance without switching
  `RATELIMIT_STORAGE_URI` to Redis (documented upgrade path).
  `SESSION_PROTECTION="strong"` and HSTS's HTTPS detection both depend on
  `TRUST_PROXY_HEADERS`/`ProxyFix` being configured correctly behind a
  real reverse proxy — reviewed/reasoned about but not exercised against
  an actual live Nginx+TLS setup in this sandbox.
- Only local filesystem storage is implemented; `STORAGE_PROVIDER=s3`
  falls back to local with a warning rather than talking to S3 — the
  adapter interface supports adding a real S3 backend with no caller
  changes, but it wasn't built.
- No real browser/visual/Lighthouse/accessibility-tooling pass — every
  rendering/accessibility assertion in this codebase's test suite is at
  the HTML-string or HTTP-response level.
- Bootstrap 5 is loaded from a CDN, not vendored — an air-gapped
  deployment would need it vendored locally.
- Blog search is a simple `ILIKE` substring match, not a dedicated
  search index; blog-list pagination slices an already-fetched Python
  list rather than using SQL `LIMIT/OFFSET` — both deliberate
  scale-appropriate tradeoffs for this app's expected single-admin,
  low-volume usage (see docs/DECISIONS.md).
- No password-reset/self-service password change; no multi-admin UI
  (the data model supports a second admin's own `Profile`, but nothing
  creates one); no bulk actions on contact messages or media.
- See docs/IMPLEMENTATION_STATE.md's full "Not verified"/"Known
  limitations" sections for the complete, phase-by-phase list (CI never
  run on GitHub Actions from this sandbox, no real SMTP server exercised,
  no polyglot-file upload testing, and more).

## 11. Unimplemented requirements versus the original spec

Compared requirement-by-requirement against docs/MASTER_PROMPT.md and
docs/PRD.md. Everything else in both documents is implemented and
verified; the following are genuine gaps, found during this phase's
spec-completeness cross-check and not fixed (schema-changing feature
work is out of Phase 9's verification/hardening scope):

- **`SiteSetting` table** (docs/MASTER_PROMPT.md's data-model list) —
  not built. There is no general-purpose, admin-editable key/value
  site-settings mechanism; global configuration is split between
  environment variables (deployment-level settings) and two
  narrowly-scoped DB tables (`PortfolioTemplate.is_active` for the
  active theme, `NavigationItem` for nav). Something like a site-wide
  title/tagline independent of `Profile`, or a maintenance-mode flag,
  has nowhere to live today without a code change.
- **`AuditLog` table** (docs/MASTER_PROMPT.md's data-model list) — not
  built. There is no queryable record of "which admin changed what,
  when" beyond structured request logs (which record that a mutating
  request happened, with a request ID, but not a before/after diff of
  the changed row). Every admin action is still authorization-checked
  and CSRF-protected — this is a traceability gap, not an access-control
  gap.
- **Docker build/Compose/container-hardening/Nginx-proxy execution** —
  reviewed and config-validated but never actually run, in any of the
  ten phases, for lack of a Docker daemon in this sandbox. See "Known
  limitations" above.

Everything else in docs/MASTER_PROMPT.md's "Required capabilities" and
docs/PRD.md — public portfolio pages, admin CMS, template engine (five
themes, DB-tracked active template, content/presentation separation),
blog authoring/publishing/scheduling/discovery/SEO, contact form with
CSRF/rate-limiting/email adapter, ordering/visibility on every listed
content type, the full security threat-model list, environment-variable
configuration, Ruff/Black/mypy/pytest/coverage/CI — is implemented and
was verified in this session or a prior phase's live verification run.
This is a release candidate, not a "complete, zero-gap" claim — the three
items above are the honest exceptions.
