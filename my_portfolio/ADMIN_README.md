# Admin Guide

This is the day-to-day guide for running your own site — logging in,
changing your password, editing content, and basic operational tasks.
(For setup/deploy instructions, see `README.md`.)

## Logging in

Visit `/admin/login` (e.g. `http://localhost:8000/admin/login`).

The admin username/password come from `ADMIN_USERNAME` / `ADMIN_PASSWORD`
in your `.env` file, but **only the very first time the app starts** — that
is when the admin account is created in the database. After that, the
password lives in the database, not in `.env`, so changing `.env` later
does nothing until you also use "Change password" below (or wipe the
database and start over).

> **Change the default password immediately.** If you started the app
> with the example `ADMIN_PASSWORD` (or any password you've since shared,
> pasted into a chat, or committed anywhere), treat it as compromised and
> change it the first time you log in.

## Changing your password

Log in, then go to **Change password** in the admin nav bar
(`/admin/change-password`). You'll need your current password plus a new
one (minimum 8 characters, entered twice). This is the only supported way
to change the password short of editing the database directly.

If you're locked out entirely (forgot the password and can't log in), the
only reset path today is to stop the app, clear the `admin_users` table
(or drop the Postgres volume entirely to reset all data), and restart —
the app will re-seed a fresh admin account from `ADMIN_USERNAME` /
`ADMIN_PASSWORD` in `.env`. There is no "forgot password" email flow (this
is a single-admin, no-email-provider setup by design).

## Editing content

Everything below is under `/admin` once logged in:

| Section | What it controls |
|---|---|
| **Site settings** | Your name/title, tagline, bio, avatar, résumé link, footer text, contact email/location, social links, and the theme's background/text/accent colors. |
| **Projects** | Each project's title, summary, full description, tech-stack tags, repo/live links, image, "featured" flag (shows it on the homepage), and manual ordering. |
| **Skills** | Skill categories (e.g. "Languages", "Data & Cloud"), each holding a list of skills with a 0–100 level shown as a retro meter bar. |
| **Experience** | Work history entries: role, company, location, start/end dates, description. Leave end date blank for a current role. |
| **Education** | Institution, degree, field, start/end dates. |
| **Posts** | Blog posts: title, summary, Markdown content, tags, cover image, published/draft toggle, manual ordering. |
| **Analytics** | Read-only view counts (all-time, last 7 days, last 30 days) per post. No visitor data (IP, cookies, fingerprints) is ever collected. |

Changes take effect immediately — no restart or redeploy needed for
content edits, only for template/CSS/code changes.

### Changing the color palette

Site Settings has three color pickers: **background**, **text**, and
**accent**. Everything else visual (card backgrounds, borders, dimmed/muted
text, and a readable "ink" version of the accent used for headings/links/
status text) is computed automatically from those three, so you only ever
need to touch these three fields to reskin the whole site. Save, then open
the homepage in another tab to preview.

The defaults (cream `#F7F0E6` background, dark green-black `#1D2B1F` text,
lime `#BFEA4B` accent) are pulled from
[causehouse.co](https://www.causehouse.co), tuned for legibility: the raw
accent is a bright highlight meant for button fills and glows, not for
text — reading it directly as text/headings would be close to invisible
(~1.2:1 contrast). The site instead derives a darker "accent-ink" blend for
anything text-like, which lands around 5:1 by default (comfortably above
the WCAG AA 4.5:1 minimum for normal text).

If you pick a custom palette, choose an accent with at least some
contrast against your background/text choices — accent-ink is *derived*
from whatever you pick, so an accent that's very close to your background
color, or identical to your text color, can still end up hard to
distinguish. There's no automatic contrast check, so eyeball the preview
after saving, especially the headings, nav links, and the skill-level
meter bars under Skills.

### Images, avatar, and résumé

On the Site Settings page and each project's edit page, every URL field
(avatar, résumé, project image) has a matching file upload field right
below it. Uploading a file overrides whatever's in the URL field. Accepted:
images (png/jpg/jpeg/gif/webp/svg) and, for the résumé, PDF — capped at
5MB each. Uploaded files are stored under `app/static/uploads/` (persisted
via the `portfolio_uploads` Docker volume, so they survive container
rebuilds).

### Writing blog posts

Go to **Posts** in the admin nav (`/admin/posts`) → **+ new post**. Write
the body in Markdown — headings, **bold**/_italic_, fenced code blocks
(with syntax highlighting), tables, and links are all supported. A `[TOC]`
line anywhere in the content renders a table of contents from your
headings.

The Markdown is converted to HTML and sanitized when you save (not on
every page view), so any pasted `<script>` tags, inline event handlers
(`onerror=`, etc.), or `javascript:` links are stripped automatically —
you don't need to trust the content you paste in.

A post only appears on the public `/blog` page (and in the RSS feed at
`/blog/rss.xml`) once **published** is checked. Uncheck it at any time to
pull a post back to draft without deleting it — its content, tags, and
view history are preserved. The **toggle publish** link on the posts list
is a shortcut for the same thing.

Cover images work exactly like project images: paste a URL or upload a
file (png/jpg/jpeg/gif/webp/svg, max 5MB).

### Reading blog analytics

**Analytics** (`/admin/analytics`) shows total views across all posts and,
per post, all-time / last-7-days / last-30-days view counts. This is
intentionally minimal: a view increments a counter for that post on that
UTC calendar day — no IP address, cookie, device fingerprint, or referrer
is ever recorded, so there's no per-visitor data to review, export, or
accidentally leak.

### Bulk-editing via content.yaml

For large changes (re-doing your whole skills list, adding several
projects at once), it's often faster to edit `content.yaml` and re-run the
loader than to click through forms one at a time:

```bash
docker compose cp content.yaml web:/app/content.yaml
docker compose exec web python scripts/load_content.py
```

**Be aware:** this replaces the entire skills / projects / experience /
education sections with whatever `content.yaml` currently says — so if
you've since made one-off edits in `/admin` to those sections, re-running
the loader will overwrite them. Site settings are merged field-by-field
instead, so admin edits there are safer to mix with the loader. See
`README.md` → "Bulk-loading content" for the full explanation and the
non-Docker equivalent command.

## Basic Docker operations

```bash
docker compose logs -f web        # tail the app's logs
docker compose restart web        # restart just the app (e.g. after editing .env)
docker compose exec web bash      # shell into the running app container
docker compose down                # stop everything (data persists in volumes)
docker compose up -d               # start it back up in the background
```

Your data lives in two named Docker volumes: `portfolio_db_data` (Postgres)
and `portfolio_uploads` (uploaded files). `docker compose down` alone does
not delete them; `docker compose down -v` does — avoid that unless you
mean to wipe everything.

## Security checklist before making this public

- [ ] Changed the admin password from whatever was in `.env` originally.
- [ ] Set a long, random `SECRET_KEY` in `.env` (used to sign the admin
      session cookie — treat it like a password).
- [ ] Set `ENVIRONMENT=production` in `.env` **only once** the site is
      served over HTTPS (e.g. behind a reverse proxy doing TLS
      termination). Setting it to `production` while still serving plain
      HTTP will make admin login silently fail (see `README.md` for why).
- [ ] `.env` and `content.yaml` are git-ignored — double check they were
      never accidentally committed if you're using version control.
- [ ] Decide what to actually put in `email` / social links in Site
      Settings — anything you enter there is shown to every site visitor.
