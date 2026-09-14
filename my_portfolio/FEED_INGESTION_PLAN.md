# Feed Ingestion Pipeline — Feature Plan, Implementation Plan & Architecture

Status: **implemented.** This document is the design record for the
feature described below; see `IMPLEMENTATION_PLAN.md` for the shipped
status list. Written so the reasoning behind each decision (dedup
strategy, why a custom parser instead of a new dependency, why drafts not
auto-publish) survives the initial build.

## 1. Problem statement

Bibek wants the portfolio's blog to also surface curated third-party
content: configure a set of website feeds (grouped by category — e.g.
"security news", "SIEM/threat-intel", "python"), have the pipeline notice
when those sites publish something new, and turn each new article into a
blog post on this site, categorized the same way the rest of the blog
already is (via `Post.tags`).

## 2. Decisions made and why

These were confirmed directly before implementation (see conversation):

| Decision | Choice | Why |
|---|---|---|
| Content mode | **Summary + attribution + link**, not full-text republish | Republishing a third party's full article text verbatim is a copyright/plagiarism risk unless you've separately confirmed each source's syndication license. A sanitized excerpt plus a clear "originally published at `<source>`" link is the safe default for arbitrary configured sources, and is what most feeds already give you (the feed's own summary/description field) without scraping the article page at all. |
| Publish workflow | **Draft for review** | Ingested posts land as unpublished `Post` rows, editable in `/admin/posts` exactly like a hand-written post. You get a final look (and can trim, retag, or reject) before anything goes live — no bad parse or mis-tagged import reaches the public site unreviewed. |
| Source type | **RSS/Atom feeds only** | Structured and reliable; a new source is just a feed URL, no per-site HTML scraper to write or maintain. Sites without a feed are out of scope for now (documented as a known limitation below). |
| Scheduling | **Both** a periodic scheduled job (cron-runnable CLI script) **and** a manual on-demand trigger (admin button) | Automatic ingestion is the point of a "pipeline," but a manual "run now" is needed for testing a newly added source and for on-demand refreshes without waiting for the next cron tick. |

## 3. Data model

Two new tables (created automatically by `Base.metadata.create_all()` —
new tables need no migration, only new *columns on an existing table*
do — see `app/database.py`), plus two new columns on `Post`:

```python
class FeedSource(Base):
    """One configured website/category to poll for new articles."""
    __tablename__ = "feed_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)          # shown in admin + as attribution
    feed_url: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)       # -> becomes a Post tag on every item from this source
    extra_tags: Mapped[str] = mapped_column(String(300), default="")        # comma-separated, appended alongside category
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    max_items_per_run: Mapped[int] = mapped_column(Integer, default=10)     # caps backlog flood on a brand-new source
    last_fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[str] = mapped_column(String(20), default="")        # "ok" | "error"
    last_error: Mapped[str] = mapped_column(String(500), default="")
    last_imported_count: Mapped[int] = mapped_column(Integer, default=0)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def tag_list(self) -> list[str]: ...   # category + extra_tags, deduplicated


class IngestedItem(Base):
    """Dedup ledger: one row per feed entry ever seen, whether or not it
    became a Post (e.g. it might have been skipped as too short). Kept
    separate from Post so dedup survives a post being edited or deleted,
    and so a skipped item is never silently re-tried forever."""
    __tablename__ = "ingested_items"
    __table_args__ = (UniqueConstraint("source_id", "guid", name="uq_ingested_source_guid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("feed_sources.id"), nullable=False)
    guid: Mapped[str] = mapped_column(String(500), nullable=False)   # feed entry id, or its link if no id
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="imported")  # "imported" | "skipped" | "error"
    detail: Mapped[str] = mapped_column(String(300), default="")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

`Post` gains (additive columns — entered in `_COLUMN_MIGRATIONS` in
`app/database.py` so an already-running database picks them up on next
startup, same mechanism used for the site-settings color columns):

```python
source_name: Mapped[str] = mapped_column(String(200), default="")  # e.g. "Krebs on Security"
source_url:  Mapped[str] = mapped_column(String(500), default="")  # link to the original article
```

`source_url` is what the public post template turns into the "originally
published at ..." attribution line; a manually-written post simply leaves
both blank.

Why not a formal `Category` table: every other taxonomy field in this
codebase (`Project.tech_stack`, `Post.tags`) is a plain comma-separated
string, not a join table (see `BLOG_PLAN.md`). A feed source's category
becomes just another tag on the posts it produces, so the existing tag
pills, and the new `/blog?tag=` filter added below, work for ingested and
hand-written posts identically with no schema split.

## 4. Feed fetching & parsing — why a custom parser, not `feedparser`

The obvious library choice is `feedparser`, but it cannot be added as a
new dependency and verified in this environment (no package-index network
access here to test the install — the same limitation the blog feature's
`IMPLEMENTATION_PLAN.md` already documents for `pytest`). Rather than add
an unverified dependency, `app/feed_parser.py` is a small, dependency-free
RSS 2.0 / Atom 1.0 parser built on the standard library's
`xml.etree.ElementTree`:

- Detects the root element (`rss`/`channel` vs. `feed`) and extracts a
  normalized list of entries: `guid`, `link`, `title`, `summary_html`,
  `published` (parsed with `email.utils.parsedate_to_datetime` for RSS's
  RFC-822 dates and `datetime.fromisoformat` — with a `Z`-suffix fixup —
  for Atom's ISO-8601 dates), and `categories`.
- `guid` falls back to `link` when a feed entry has no `<guid>`/`<id>`,
  since the entry needs *some* stable dedup key.
- Malformed XML raises a caught, logged `FeedParseError` rather than an
  unhandled exception, so one broken source doesn't take the whole
  ingestion run down.
- This also means feed content is trivially unit-testable: tests feed a
  literal RSS/Atom XML string straight to the parser, no network or mocks
  required (see `tests/test_smoke.py`).

Fetching uses `urllib.request` (standard library) with a `User-Agent`
header, a connect timeout, and a response-size cap (feeds are small; a cap
avoids a misbehaving or malicious URL streaming an unbounded response).
This is also dependency-free by the same reasoning as the parser.

If a real HTML-scraping source is ever needed later, that is an additive
`app/scrapers/` module behind the same `IngestedEntry` shape the feed
parser returns — the pipeline and dedup logic below don't change.

## 5. Ingestion pipeline (`app/ingestion.py`)

`run_ingestion(db, source_id: int | None = None) -> IngestionSummary`:

1. Load enabled `FeedSource` rows (or just the one requested).
2. For each source: fetch the feed URL; on any fetch/parse error, record
   `last_status="error"`, `last_error=<message>`, commit, and move on to
   the next source (one bad feed never blocks the others).
3. On success, take entries newest-first, capped at
   `source.max_items_per_run`.
4. For each entry, skip if `(source_id, guid)` already exists in
   `IngestedItem` (already seen, whether imported or skipped before).
5. Otherwise: sanitize the entry's summary/description HTML with the new
   `sanitize_external_html()` in `app/markdown_utils.py` (same nh3
   allowlist approach as post Markdown, applied directly to feed-supplied
   HTML instead of via python-markdown). Skip (record `status="skipped"`)
   if the entry has no title or the sanitized excerpt is empty after
   stripping tags — nothing worth publishing.
6. Create a **draft** `Post` (`published=False`): `title` from the entry
   (truncated to 200 chars), `summary` from the excerpt (plain-text,
   truncated to 300 chars), `content_markdown` = the sanitized excerpt
   HTML *only* (python-markdown passes through simple HTML blocks largely
   unchanged, so a later manual edit + re-save via the normal admin form
   still round-trips), `content_html` = the sanitized HTML directly (skips
   a redundant markdown render on ingestion — the admin edit path still
   re-renders through `render_post_html()` as normal if it's touched),
   `tags` = `source.tag_list` joined, `source_name`/`source_url` set,
   `slug` uniqued the same way `_unique_post_slug` already works for
   hand-written posts. The "originally published at ..." attribution is
   **not** baked into `content_html`/`content_markdown` — it's rendered
   exactly once, from `source_name`/`source_url`, by `blog_detail.html`'s
   own attribution block (section 8). An earlier version of this pipeline
   baked a duplicate attribution paragraph into the stored body as well,
   which showed up as the line rendering *twice* on the post detail page
   during live verification against a real feed (Docker `docker compose
   up`, `/admin/sources` → run now → published draft → viewed on
   `/blog/<slug>`) — fixed by keeping attribution as template-rendered
   structured data (`source_name`/`source_url`) only, never duplicated
   into the free-text body.
7. Record the `IngestedItem` row (`status="imported"`, `post_id` set).
8. After all entries: update `source.last_fetched_at`,
   `last_status="ok"`, `last_imported_count`, commit.

Returns an `IngestionSummary` (per-source counts: fetched / imported /
skipped / errored) — used both by the CLI script (printed) and the admin
"run now" button (flashed as a query-string summary).

## 6. Running it

**Scheduled (cron):**

```
*/30 * * * *  cd /path/to/my_portfolio && python scripts/ingest_feeds.py >> /var/log/portfolio-ingest.log 2>&1
```

`scripts/ingest_feeds.py` is a thin CLI wrapper: opens a DB session, calls
`run_ingestion(db)`, prints a per-source summary line, exits non-zero if
every configured source errored (so a cron-failure-notification setup has
something to alert on) — mirrors the existing `scripts/load_content.py`
pattern (a standalone script that opens its own session against
`app.database.SessionLocal`).

**Manual (admin):** `/admin/sources` lists every configured source with
its last-run status; each row has a "run now" button
(`POST /admin/sources/{id}/run`) plus a page-level "run all enabled"
button (`POST /admin/sources/run`) — both call the same
`run_ingestion()` and redirect back with a one-line result summary.

**Docker:** no new service needed — the ingestion script runs via the
same `web` container's `docker compose exec web python scripts/ingest_feeds.py`,
driven by the *host's* cron (or a `cron`-in-sidecar container if the
deployment target has no host cron access — left as a
deployment-environment choice, documented in `README.md` rather than
hardcoded, since it depends on where this is actually deployed).

## 7. Admin UI

- New nav item **sources**, alongside the existing posts/analytics.
- `/admin/sources` — table: name, feed URL, category, enabled/disabled
  pill, last run time + status (ok/error, with the error message on
  hover/below), items imported last run, "run now" / edit / delete.
- `/admin/sources/new` and `/admin/sources/{id}/edit` — the same
  form-with-inline-validation pattern as `post_form.html`
  (name, feed URL, category, extra tags, max items per run, enabled
  checkbox).
- Same CSRF protection as every other admin POST (`require_csrf`
  dependency, hidden `csrf_token` field).
- Dashboard gains a `sources` count tile alongside the existing four.

## 8. Public-facing: categorization

- `/blog` accepts `?tag=<value>` and filters posts whose `tag_list`
  contains it (case-insensitive) — works identically for ingested and
  hand-written posts since both just populate `Post.tags`.
- Blog list page's tag pills become links to `/blog?tag=<tag>` instead of
  plain text, so a reader can click "security-news" and see only that
  category.
- Post detail page shows the attribution line (source name + link to the
  original) whenever `post.source_url` is set; blank (nothing rendered)
  for hand-written posts.

## 9. Validation & safety

| Field | Validation |
|---|---|
| `name` | required, 1–150 chars |
| `feed_url` | required, must parse as `http`/`https`, ≤500 chars, unique |
| `category` | required, 1–80 chars |
| `extra_tags` | optional, ≤300 chars |
| `max_items_per_run` | 1–50 (hard cap prevents one source flooding the review queue) |

Same re-render-with-error pattern as `post_form.html` on validation
failure. Fetch timeouts (10s connect/read) and a response-size cap (2 MB)
protect ingestion from a slow or huge feed response; per-source try/except
means one bad source can't abort the run for the others.

## 10. Testing strategy (see `tests/test_smoke.py`)

Everything network-independent, since this sandbox and the linked
machine both have no package-index/outbound network access (documented
limitation carried over from the original blog feature build) — the
*parser* and *pipeline* are structured so tests never need real network:

- `feed_parser` unit tests: literal RSS 2.0 and Atom XML strings in the
  test file → assert the normalized entries (guid/link/title/summary
  extraction, RSS vs. Atom date parsing, missing-guid → link fallback,
  malformed-XML → `FeedParseError`).
- `run_ingestion` tests: monkeypatch the module's `_fetch_feed_bytes`
  function (the one function that touches the network) to return a fixed
  XML payload, then assert against the DB: a `FeedSource` + draft `Post`
  rows are created with the right tags/attribution, a second run against
  the same fixed payload imports **zero** new posts (dedup works), and a
  source whose fetch is monkeypatched to raise records `last_status="error"`
  without touching other sources.
- Admin route tests: `/admin/sources*` requires login (existing
  `require_admin` pattern) and rejects a POST without a CSRF token
  (existing `require_csrf` pattern) — same two assertions every other
  admin resource already has tests for.
- As with the rest of this codebase in this environment: a live `pytest`
  run against real installed dependencies was **not** possible here (no
  `fastapi`/`sqlalchemy`/etc. installed, no network to install them) — all
  new code was verified with `py_compile` (syntax) and manual template
  parsing, consistent with how the original blog feature was verified.
  **Please run `pip install -r requirements-dev.txt && pytest` locally**
  to get a real pass/fail signal before deploying.

## 11. Known limitations / explicit non-goals

- RSS/Atom only — a source without a feed is out of scope (HTML scraping
  was explicitly deferred).
- One category per source, not per-article — if a feed mixes categories,
  every item from it gets the same tag. Splitting a mixed feed means
  configuring it twice with two different `feed_url`s pointing at
  per-category feed variants, if the site offers them.
- No full-text extraction/readability parsing of the linked article page
  — only the feed's own summary/description is used, by design (content
  mode decision above).
- No image import from the source article — ingested posts have no
  `cover_image_url` unless the admin adds one while reviewing the draft.
