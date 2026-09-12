# My Portfolio

> Day-to-day site operation (logging in, changing your password,
> editing content, Docker basics) lives in `ADMIN_README.md`. This file
> covers setup, architecture, and deployment.

A minimal, configurable, retro-terminal-styled portfolio site for a
software/hardware engineer, with an admin panel for editing everything
without touching code. Built with FastAPI (no Django), Postgres, and Jinja2
server-rendered templates. Fully dockerized.

## Features

- Public site: hero/bio, featured + full project list with detail pages,
  skills (grouped, with retro "meter" bars), experience & education timeline,
  contact section.
- Admin panel (`/admin`): single admin login, edit site settings (title,
  tagline, bio, avatar, resume link, background/text/accent colors, social
  links), full CRUD
  for projects, skill categories/skills, experience, and education.
- File uploads: avatar, resume (PDF), and project images can either be a
  pasted URL or an uploaded file straight from the admin forms — uploads are
  saved under `app/static/uploads/` (validated by extension + 5MB size cap).
- Change password: logged-in admins can change their own password from
  `/admin/change-password` (see `ADMIN_README.md` for day-to-day admin
  operations, including this and bulk content loading).
- Config-driven: nothing about the content is hardcoded in templates; it all
  comes from the database via the admin panel.
- Retro minimal theme with a swappable palette: background, text, and
  accent colors are all editable from the admin panel (Site Settings), with
  panel backgrounds, borders, and dimmed text derived automatically from
  those three via CSS `color-mix()` so the theme stays coherent for any
  combination. Defaults are pulled from
  [causehouse.co](https://www.causehouse.co) (an Awwwards-featured site) —
  cream background `#F7F0E6`, dark green-black text `#1D2B1F`, lime accent
  `#BFEA4B`.
- Dockerized: `docker-compose up` gets you the app + Postgres.
- Designed to be expandable — see "Future: blogging" below.

## Tech stack

- **FastAPI** + **Uvicorn** — web framework / ASGI server
- **SQLAlchemy 2.x** — ORM
- **PostgreSQL** — database (SQLite works too for quick local runs, see below)
- **Jinja2** — server-rendered templates
- **Passlib (bcrypt)** — admin password hashing
- **Starlette SessionMiddleware** — signed-cookie admin sessions (no session
  table needed)

## Project layout

```
app/
  main.py            FastAPI app, startup (create tables + seed admin)
  config.py          Settings from environment variables / .env
  database.py         SQLAlchemy engine/session, init_db()
  models.py           SiteSettings, AdminUser, Project, SkillCategory, Skill,
                      Experience, Education
  security.py         Password hashing helpers
  seed.py             Bootstraps the admin user + default site settings row
  deps.py             get_db, get_site_settings, require_admin
  routers/
    public.py         Public site routes
    admin.py           Admin auth + CRUD routes
  templates/           Jinja2 templates (public/, admin/, partials/)
  static/
    css/retro.css      The entire visual theme
    js/admin.js         Placeholder for future interactivity
tests/
  test_smoke.py        Boots the app, hits every page, checks the admin
                        auth gate and login flow
Dockerfile
docker-compose.yml      app + postgres
docker-compose.override.example.yml   optional dev override (hot reload)
.env.example
```

## Running locally without Docker

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt   # or requirements.txt for prod-only
cp .env.example .env
# For a quick local run without Postgres, set in .env:
#   DATABASE_URL=sqlite:///./portfolio.db
uvicorn app.main:app --reload
```

Visit http://localhost:8000 for the site and http://localhost:8000/admin
for the admin panel (default admin/password come from `ADMIN_USERNAME` /
`ADMIN_PASSWORD` in `.env` — **change these before deploying**, they are
only used the very first time the app starts, to create the admin user).

## Running with Docker

```bash
cp .env.example .env
# edit .env: set SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD, POSTGRES_* as you like
docker compose up --build
```

The app will be at http://localhost:8000. Postgres data persists in the
`portfolio_db_data` named volume.

> **Admin login over plain HTTP:** keep `ENVIRONMENT=development` in `.env`
> while you're serving the site over `http://` (the default). If you set
> `ENVIRONMENT=production` without also putting the app behind HTTPS (e.g. a
> reverse proxy doing TLS termination), the admin session cookie is marked
> HTTPS-only and the browser will never send it back — login will appear to
> silently fail even though the credentials are correct. Only switch to
> `production` once HTTPS is actually in front of the app.

For local development with live reload against Postgres in Docker:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose up --build
```

## Running tests

```bash
pip install -r requirements-dev.txt
pytest
```

(Tests default to a local SQLite file so they don't require Postgres.)

## Configuring the site

Everything content-related is edited from `/admin` after logging in:

- **Site settings** — title, tagline, bio, avatar/resume URLs, footer text,
  contact info & social links, background/text/accent colors.
- **Projects** — title, summary, full description, tech stack tags, repo/live
  links, image, featured flag (shows on homepage), manual ordering.
- **Skills** — categories (e.g. "Languages", "Hardware") each containing
  skills with a 0–100 level shown as a retro meter bar.
- **Experience / Education** — role/company/dates/description entries shown
  as a timeline.

No redeploy is needed for content changes — only for template/CSS/code
changes.

### Bulk-loading content from a template

Editing everything by hand through `/admin` the first time is tedious, so
`content.example.yaml` is a filled-in-the-blanks template covering site
settings, skills, projects, experience, and education, plus a script that
loads it straight into the database in one shot.

```bash
cp content.example.yaml content.yaml
# edit content.yaml with your real details
```

`content.yaml` is git-ignored and docker-ignored on purpose — it holds your
personal details and is never committed or baked into the image.

If you're running with Docker Compose (`docker compose up`), copy the file
into the running container and execute the loader inside it:

```bash
docker compose cp content.yaml web:/app/content.yaml
docker compose exec web python scripts/load_content.py
```

If you're running locally without Docker (`uvicorn app.main:app`), just run
it directly against your virtualenv, from the project root:

```bash
python scripts/load_content.py
```

The script is safe to re-run: `site_settings` fields are merged into the
existing row, while `skills` / `projects` / `experience` / `education` are
each fully replaced with whatever content.yaml currently lists — treat it as
the source of truth for bulk imports, and use `/admin` for day-to-day
tweaks afterwards (running the script again will overwrite any admin-panel
edits to those four sections).

## Platform independence

The app has no OS-specific dependencies; the Dockerfile uses `python:3.11-slim`
and runs identically on Linux/macOS/Windows hosts via Docker. Swapping
Postgres for another SQLAlchemy-supported database is a one-line change to
`DATABASE_URL`.

## Upgrading an existing database (background/text color fields)

If your database already existed before background/text color support was
added, you don't need to do anything — `init_db()` runs a small built-in
migration on startup that adds the two new columns to `site_settings` and
backfills sensible defaults (and re-themes the accent color too, but only
if it's still exactly the old default, i.e. you haven't customized it).
This is a plain `ALTER TABLE`, not Alembic — see the comment above
`_COLUMN_MIGRATIONS` in `app/database.py` if the schema grows enough to
warrant switching to real migrations.

## Future: blogging (not in current scope)

The codebase is deliberately structured so adding a blog later is additive,
not a rewrite:

- Add a `Post` (and optional `Tag`) model in `models.py`.
- Add `app/routers/blog.py` (public list/detail) and extend `admin.py` with
  Post CRUD, following the same pattern as `Project`.
- Add `templates/public/blog_list.html` / `blog_detail.html` and
  `templates/admin/post_form.html`, reusing `retro.css`.
- Once the schema stabilizes, consider moving from `Base.metadata.create_all`
  to Alembic migrations (not needed yet, but the codebase doesn't fight it).
