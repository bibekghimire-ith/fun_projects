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

## Not yet done / suggested next steps

1. **Run the app locally** (see README) and eyeball the retro styling —
   design is subjective and worth a manual look.
2. **Reordering UX**: `order_index` fields exist on every content type but
   are edited as plain numbers. A drag-and-drop reorder widget (small bit of
   JS + a `/admin/.../reorder` endpoint) would be a nice follow-up.
3. **Alembic migrations**: schema currently applies via
   `Base.metadata.create_all()` at startup, which is fine while the schema is
   young. Once you start doing production data migrations, swap in Alembic.
4. **Blogging** (explicitly out of scope now): see the "Future: blogging"
   section in `README.md` for the intended shape of the change.
5. **CI**: no CI pipeline was set up. A minimal GitHub Actions workflow
   running `pytest` on push would be a natural addition once this is in git.
6. **Secrets**: `.env.example` is committed but `.env` is git-ignored — make
   sure to set a real `SECRET_KEY` and a strong `ADMIN_PASSWORD` before any
   real deployment; the defaults are intentionally insecure placeholders.

## File map (for orientation)

See the "Project layout" section in `README.md`.
