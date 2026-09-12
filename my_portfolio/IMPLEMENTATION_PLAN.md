# Implementation Plan — Portfolio App

## Goals recap
- Configurable, minimal, retro-styled portfolio for a software/hardware engineer.
- Python stack, explicitly **not Django** → chosen: FastAPI.
- Admin panel to configure the whole website (no code edits for content changes).
- Platform-independent / dockerized.
- Expandable (blogging planned, explicitly out of scope for now).

## Decisions made (confirmed with user)
| Area | Choice | Why |
|---|---|---|
| Framework | FastAPI | Modern, fast, plays well with Jinja2 for server-rendered pages, easy to extend with routers per feature. |
| Data storage | PostgreSQL + SQLAlchemy | Robust, production-grade, easy to run alongside the app in Docker Compose; SQLite still supported for local dev via `DATABASE_URL`. |
| Admin auth | Single admin user, session login | Simple, no external auth provider, hashed password (bcrypt) + signed session cookie (Starlette `SessionMiddleware`). |
| Rendering | Server-rendered Jinja2 templates | Simplest possible, no build step, matches "minimal" requirement. |

## Status: implemented (this pass)

- [x] Project scaffolding (`app/`, `tests/`, Docker files)
- [x] `requirements.txt` / `requirements-dev.txt`
- [x] Config via env vars (`app/config.py`, `.env.example`)
- [x] SQLAlchemy models: `SiteSettings`, `AdminUser`, `Project`, `SkillCategory`,
      `Skill`, `Experience`, `Education`
- [x] DB bootstrap (`init_db`, `seed.py` creates the admin user + default
      settings row from env on first startup)
- [x] Admin auth (login/logout, session-gated `require_admin` dependency)
- [x] Admin CRUD: site settings, projects, skill categories/skills,
      experience, education
- [x] Public pages: home, project list, project detail, experience/education
- [x] Retro terminal theme (`retro.css`) with a configurable accent color
- [x] Dockerfile + docker-compose.yml (app + Postgres, healthchecks)
- [x] Smoke tests (`tests/test_smoke.py`) covering public pages, admin gate,
      and the login flow
- [x] File uploads for avatar, resume (PDF), and project images (validated by
      extension + 5MB size cap, saved under `app/static/uploads/`, with the
      existing URL fields kept as a fallback/manual-entry option)
- [x] Admin "change password" flow (`/admin/change-password`), since the
      env-seeded password only applies on first startup
- [x] `content.example.yaml` template + `scripts/load_content.py` bulk
      loader for site settings / skills / projects / experience / education
- [x] `content.yaml` populated with what's actually known (name, role
      context, tech stack) — projects / experience / education left empty
      rather than invented, since exact dates/titles/history and any
      public-facing project list weren't known; see the comments in
      `content.yaml` for what still needs filling in
- [x] `ADMIN_README.md` — day-to-day operator guide (login, password
      change, content editing, uploads, bulk loading, Docker basics,
      pre-launch security checklist)
- [x] Configurable background + text color (paired with the existing accent
      color), defaulting to the palette from https://www.causehouse.co
      (Awwwards-featured): cream `#F7F0E6` bg, dark green-black `#1D2B1F`
      text, lime `#BFEA4B` accent. Panel background / border / dimmed-text
      shades are derived from these three via CSS `color-mix()` rather than
      being separate settings.
- [x] Lightweight column-migration mechanism (`app/database.py`,
      `_run_column_migrations`) so an already-running database picks up the
      two new columns (and a one-time accent re-theme, only if untouched)
      without needing Alembic or a fresh database.
- [x] Project images now render on the homepage's featured grid, the public
      `/projects` list, and as a thumbnail in the admin projects table
      (previously only shown on a project's own detail page).
- [x] README with run/deploy instructions
- [x] Verified: all Python files compile (`py_compile`) and all 16 Jinja
      templates parse without error. Full `pytest` run against live
      dependencies was **not** possible from this session (package installs
      were blocked by network policy on both the linked machine and the
      cloud sandbox) — **please run `pip install -r requirements-dev.txt &&
      pytest` locally once to confirm**, since this hasn't executed the app
      end-to-end yet.

## Status: implemented (blogging pass, per BLOG_PLAN.md)

- [x] `Post` / `PostView` models, brand-new tables picked up automatically
      by `Base.metadata.create_all()` (no column-migration entry needed).
- [x] `app/markdown_utils.py`: Markdown → HTML via `python-markdown`
      (fenced code, tables, TOC, codehilite), sanitized with `nh3` against
      an explicit tag/attribute allowlist — rendered once at save time,
      never on the public request path.
- [x] Admin CRUD for posts (`/admin/posts`, new/edit/delete/toggle-publish)
      with inline validation errors that preserve submitted input, mirroring
      the existing Project form pattern.
- [x] Public blog (`app/routers/blog.py`): `/blog` (paginated list, published
      only), `/blog/{slug}` (404 for missing/unpublished, increments the
      view counter), `/blog/rss.xml` (RSS 2.0 feed).
- [x] Privacy-preserving analytics: a `PostView` row per post per UTC day
      (`day`, `count` only — no IP, cookie, fingerprint, or referrer),
      surfaced at `/admin/analytics` with all-time/7-day/30-day rollups.
- [x] Field validation: title/summary/tags/content/cover-URL length limits
      enforced server-side on every post save, with the Post form re-rendered
      (not discarded) on failure.
- [x] CSRF protection: `app/security.py` gained a session-bound token
      (`get_or_create_csrf_token` / `verify_csrf_token` / `require_csrf`);
      every state-changing admin route now requires it (`login` is the one
      documented exception — it doesn't act on an existing session), and a
      hidden `csrf_token` field was added to every existing admin `<form
      method="post">`, not just the new post forms.
- [x] Security response headers (`app/main.py` middleware):
      `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
      `Referrer-Policy: same-origin`, `Content-Security-Policy:
      frame-ancestors 'none'` on every response.
- [x] Retro-styled blog templates: public list/detail pages reusing the
      existing card/tag/panel classes, cover-image thumbnails on the admin
      posts list (`.admin-thumb`), a `.prose` style block for rendered post
      content (headings, code blocks, blockquotes, tables), and
      `.status-pill` published/draft indicators.
- [x] `tests/test_smoke.py` extended: CSRF-token helper for every existing
      POST test, a test asserting a POST without a token is rejected,
      Markdown-sanitization tests (script tags, event handlers, `javascript:`
      links), slug-uniqueness, unpublished-post 404, view-counter
      incrementing, RSS well-formedness, and admin-posts auth gating.
- [x] `README.md` / `ADMIN_README.md` updated to document the blog feature,
      analytics, and CSRF/security-header hardening as shipped rather than
      planned.
- [x] Verified: all Python files compile (`py_compile`) and all 22 Jinja
      templates parse without error. As before, a full `pytest` run against
      live dependencies was **not** possible from this session (package
      installs are blocked by network policy on both the linked machine and
      the cloud sandbox) — **please run `pip install -r
      requirements-dev.txt && pytest` locally once to confirm**, and see
      "Not yet done" below for the one manual step this implies.

## Status: implemented (default color palette finalization)

- [x] **Accessibility bug found and fixed**: the shipped default palette
      (lime accent on cream background) had raw accent-as-text at only
      ~1.2:1 contrast against the background — nav links, section
      headings, card titles, hero heading, "success" messages, dashboard
      stat numbers, and skill-meter fills were all functionally invisible
      to anyone without perfect vision, and outline-style buttons (accent
      border + accent text on a transparent background) were barely
      visible at all. The form-error color (`#ff5555`) was also low
      contrast (~2.8:1).
- [x] Introduced `--accent-ink` (`app/templates/base.html`, derived via
      `color-mix(in srgb, var(--accent), var(--fg) 65%)`; static fallback
      in `retro.css`): a darker blend of accent + text color used
      wherever accent appears as TEXT or a text-adjacent border (links,
      headings, success text, status pills, skill-meter fill, focus
      rings, hover borders) — ~5:1 contrast by default, above the WCAG AA
      4.5:1 threshold for normal text. Raw `--accent` is now reserved for
      large fills where something else on top carries the contrast (the
      button's own text, the decorative avatar ring).
- [x] Redesigned `.btn` from an accent-outline-on-transparent style
      (~1.2:1, barely visible) to a solid accent-filled button with `--fg`
      text (~10.6:1 contrast for the default palette); hover inverts to an
      `--accent-ink` outline.
- [x] Added `--error` (`#B3261E`, ~5.8:1 against the default background) to
      replace the previous hardcoded `#ff5555` (~2.8:1) for form error
      text.
- [x] Updated the Site Settings help text and `ADMIN_README.md` to explain
      accent-ink and steer admins picking a custom palette toward
      choosing an accent with real contrast against their background/text.
- [x] Verified: all Python files still compile and all 22 templates still
      parse; the CSS file's braces balance (no structural syntax check
      tool was available without network access — see the recurring
      caveat about `pip install` being blocked in this session).

## Not yet done / suggested next steps

1. **Run `pytest` locally** — this is now the single most important
   pending step. The whole CSRF-hardening and blog implementation was
   verified only by syntax/template-parse checks (no network access to
   install FastAPI/SQLAlchemy/etc. in this session); a real test run is
   needed before treating this as production-ready.
2. **Rebuild the Docker image** before deploying: this pass changed
   `requirements.txt` (added `markdown`, `nh3`, `pygments`) and added new
   Python modules/routes, so `docker compose build web && docker compose up
   -d` is required — a plain restart of an already-running container will
   not pick these up.
3. **Reordering UX**: `order_index` fields exist on every content type but
   are edited as plain numbers. A drag-and-drop reorder widget (small bit of
   JS + a `/admin/.../reorder` endpoint) would be a nice follow-up.
4. **Alembic migrations**: schema currently applies via
   `Base.metadata.create_all()` at startup, which is fine while the schema is
   young. Once you start doing production data migrations, swap in Alembic.
5. **Validation UX scoping trade-off**: Project and Post forms re-render
   with the submitted values and an inline error on validation failure;
   Skill/SkillCategory/Experience/Education forms instead return a plain
   `HTTPException(400)` (no re-render). This was a deliberate scope
   decision to keep this pass tractable — worth revisiting if those forms
   see heavy hand-editing.
6. **CI**: no CI pipeline was set up. A minimal GitHub Actions workflow
   running `pytest` on push would be a natural addition once this is in git.
7. **Secrets**: `.env.example` is committed but `.env` is git-ignored — make
   sure to set a real `SECRET_KEY` and a strong `ADMIN_PASSWORD` before any
   real deployment; the defaults are intentionally insecure placeholders.

## File map (for orientation)

See the "Project layout" section in `README.md`.
