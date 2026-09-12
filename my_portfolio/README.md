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
  panel backgrounds, borders, dimmed text, and a readable "ink" variant of
  the accent color all derived automatically from those three via CSS
  `color-mix()` so the theme stays coherent — and legible — for any
  combination. The accent-ink derivation exists because a bright accent
  color that looks great as a button fill is often close to unreadable as
  plain text (the shipped default's raw accent-on-background contrast is
  ~1.2:1); accent-ink blends the accent toward the text color to land
  around 5:1, above the WCAG AA threshold for normal text, and is what's
  actually used for headings, links, success messages, and status text —
  buttons, meter fills, and focus/hover accents use the raw accent color or
  the ink variant depending on which reads better against what's behind
  them (see the comments in `retro.css`). Defaults are pulled from
  [causehouse.co](https://www.causehouse.co) (an Awwwards-featured site) —
  cream background `#F7F0E6`, dark green-black text `#1D2B1F`, lime accent
  `#BFEA4B`.
- **Blog**: Markdown-authored posts with sanitized HTML output (safe against
  `<script>`, event-handler, and `javascript:`-link injection), fenced code
  blocks with syntax highlighting, tables, and an optional table of
  contents. Drafts vs. published state, cover images (URL or upload), tags,
  manual ordering, and an RSS feed at `/blog/rss.xml`.
- **Privacy-preserving analytics**: a per-post, per-UTC-day view counter
  (`/admin/analytics`) with 7-day/30-day rollups — no IP address, cookie,
  fingerprint, or referrer is ever stored.
- **Security hardening**: CSRF tokens on every state-changing admin form,
  server-side field-length validation everywhere (with inline error +
  preserved input on the Project and Post forms), and baseline security
  response headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Content-Security-Policy: frame-ancestors 'none'`) on
  every response.
- Dockerized: `docker-compose up` gets you the app + Postgres.

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
                      Experience, Education, Post, PostView
  security.py         Password hashing + CSRF token helpers
  markdown_utils.py   Markdown -> sanitized HTML rendering for blog posts
  seed.py             Bootstraps the admin user + default site settings row
  deps.py             get_db, get_site_settings, require_admin
  routers/
    public.py         Public site routes (projects, experience, home)
    admin.py           Admin auth + CRUD routes (incl. posts, analytics)
    blog.py             Public blog routes (list, detail, RSS)
  templates/           Jinja2 templates (public/, admin/, partials/)
  static/
    css/retro.css      The entire visual theme (incl. blog "prose" styles)
    js/admin.js         Placeholder for future interactivity
tests/
  test_smoke.py        Boots the app, hits every page, checks the admin
                        auth gate, CSRF enforcement, login flow, markdown
                        sanitization, and blog CRUD/analytics/RSS behavior
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
- **Blog posts** (`/admin/posts`) — title, summary, Markdown content, tags,
  cover image (URL or upload), published/draft state, manual ordering.
  Published posts appear at `/blog` and in the RSS feed at
  `/blog/rss.xml`; drafts are only visible from the admin panel.
- **Analytics** (`/admin/analytics`) — read-only: total views, and
  7-day/30-day view rollups per post.

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

## Blogging

The blog feature described in `BLOG_PLAN.md` is implemented: Markdown
authoring with sanitized HTML output, privacy-preserving view analytics,
field validation, CSRF-protected admin forms, retro-styled public
templates with cover-image thumbnails, and an RSS feed. `BLOG_PLAN.md` is
kept as the design record — see it for the reasoning behind specific
choices (e.g. why login is exempt from CSRF, why analytics only ever
stores a date + a count).
