"""The ingestion pipeline: poll configured FeedSource rows, turn new feed
entries into draft Post rows, and record everything seen in
IngestedItem so nothing is ever imported twice.

Entry point: `run_ingestion(db, source_id=None) -> IngestionSummary`.
Used by both `scripts/ingest_feeds.py` (cron) and the admin "run now"
buttons (`app/routers/admin.py`) -- same function, same behavior, just a
different caller.

Network access is isolated in `_fetch_feed_bytes()` so tests can
monkeypatch that one function and exercise the whole pipeline (dedup,
tagging, error handling) without a real network call -- see
FEED_INGESTION_PLAN.md section 10 and tests/test_smoke.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError

from slugify import slugify
from sqlalchemy.orm import Session

from app.feed_parser import FeedEntry, FeedParseError, parse_feed
from app.markdown_utils import sanitize_external_html
from app.models import FeedSource, IngestedItem, Post

_USER_AGENT = "Mozilla/5.0 (compatible; PortfolioFeedIngestor/1.0; +https://example.invalid)"
_FETCH_TIMEOUT_SECONDS = 10
_MAX_RESPONSE_BYTES = 2 * 1024 * 1024  # 2 MB -- feeds are small; a cap bounds a misbehaving URL

_MAX_TITLE_CHARS = 200
_MAX_SUMMARY_CHARS = 300
_MAX_EXCERPT_HTML_CHARS = 4000  # keeps the ingested post body a "summary", not a full article


@dataclass
class SourceResult:
    source_id: int
    source_name: str
    fetched: int = 0
    imported: int = 0
    skipped: int = 0
    status: str = "ok"  # "ok" | "error"
    error: str = ""


@dataclass
class IngestionSummary:
    results: list[SourceResult] = field(default_factory=list)

    @property
    def total_imported(self) -> int:
        return sum(r.imported for r in self.results)

    @property
    def any_errors(self) -> bool:
        return any(r.status == "error" for r in self.results)

    def as_text(self) -> str:
        lines = []
        for r in self.results:
            if r.status == "error":
                lines.append(f"[{r.source_name}] ERROR: {r.error}")
            else:
                lines.append(
                    f"[{r.source_name}] fetched={r.fetched} imported={r.imported} skipped={r.skipped}"
                )
        return "\n".join(lines) if lines else "(no enabled sources)"


def _fetch_feed_bytes(url: str) -> bytes:
    """The only function in this module that touches the network --
    monkeypatch this in tests. Raises URLError/OSError/ValueError on
    failure; callers are expected to catch and record it per-source."""
    request = Request(url, headers={"User-Agent": _USER_AGENT})
    with urlopen(request, timeout=_FETCH_TIMEOUT_SECONDS) as response:
        raw = response.read(_MAX_RESPONSE_BYTES + 1)
    if len(raw) > _MAX_RESPONSE_BYTES:
        raise ValueError(f"feed response exceeded {_MAX_RESPONSE_BYTES} bytes, refusing to parse")
    return raw


def _plain_text_excerpt(html: str, max_chars: int) -> str:
    """Very small HTML-to-text helper for building Post.summary (which is
    plain text, not HTML) from a feed's HTML description. Not meant to be
    a general HTML renderer -- just strips tags for a short preview."""
    import re

    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_chars]


def _unique_post_slug(db: Session, title: str) -> str:
    base_slug = slugify(title) or "post"
    slug = base_slug
    counter = 2
    while db.query(Post).filter(Post.slug == slug).first() is not None:
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


def _safe_external_link(link: str) -> str:
    """Only http(s) links are ever turned into an <a href> (Post.source_url,
    rendered by blog_detail.html's own attribution block) -- anything else
    (a malformed link, or a feed trying to smuggle a javascript: URI) is
    dropped rather than stored as a clickable link. Also guards against the
    same string being embedded a second time in content_html/markdown if a
    future caller reintroduces that (see the note on _ingest_entry below)."""
    if link.startswith("http://") or link.startswith("https://"):
        return link
    return ""


def _ingest_entry(db: Session, source: FeedSource, entry: FeedEntry) -> IngestedItem:
    """Sanitize, validate, and either create a draft Post + an "imported"
    IngestedItem, or an IngestedItem alone marked "skipped". Never raises
    for ordinary bad-content cases (empty title, empty excerpt) -- those
    are legitimate skip reasons, not pipeline errors."""
    title = (entry.title or "").strip()[:_MAX_TITLE_CHARS]
    excerpt_html = sanitize_external_html(entry.summary_html or "")[:_MAX_EXCERPT_HTML_CHARS]
    plain_excerpt = _plain_text_excerpt(excerpt_html, _MAX_SUMMARY_CHARS)

    if not title:
        return IngestedItem(
            source_id=source.id, guid=entry.guid, status="skipped", detail="no title"
        )
    if not plain_excerpt:
        return IngestedItem(
            source_id=source.id, guid=entry.guid, status="skipped", detail="empty summary/body"
        )

    # content_markdown/content_html hold ONLY the sanitized excerpt --
    # NOT a baked-in attribution line. The attribution ("Originally
    # published at ...") is rendered once, from source_name/source_url,
    # by blog_detail.html's own attribution block. Baking a second copy
    # in here would double up with that template block -- this was
    # caught during live verification against a real feed and fixed.
    post = Post(
        title=title,
        slug=_unique_post_slug(db, title),
        summary=plain_excerpt,
        content_markdown=excerpt_html,
        content_html=excerpt_html,
        tags=", ".join(source.tag_list),
        published=False,  # always a draft for review -- see FEED_INGESTION_PLAN.md section 2
        published_at=None,
        source_name=source.name,
        # Restricted to http(s) -- a feed can't smuggle a javascript: URI
        # into the template's attribution link this way.
        source_url=_safe_external_link(entry.link),
    )
    db.add(post)
    db.flush()  # assign post.id without committing yet

    return IngestedItem(
        source_id=source.id, guid=entry.guid, post_id=post.id, status="imported"
    )


def _run_source(db: Session, source: FeedSource) -> SourceResult:
    result = SourceResult(source_id=source.id, source_name=source.name)
    try:
        raw = _fetch_feed_bytes(source.feed_url)
        entries = parse_feed(raw)
    except (FeedParseError, URLError, OSError, ValueError) as exc:
        result.status = "error"
        result.error = str(exc)
        source.last_status = "error"
        source.last_error = str(exc)[:500]
        source.last_fetched_at = datetime.utcnow()
        db.add(source)
        db.commit()
        return result

    result.fetched = len(entries)

    already_seen = {
        row.guid
        for row in db.query(IngestedItem.guid).filter(IngestedItem.source_id == source.id).all()
    }
    new_entries = [e for e in entries if e.guid not in already_seen]
    # Newest first, capped -- avoids flooding the review queue the first
    # time a source with a long history is added.
    new_entries.sort(key=lambda e: e.published or datetime.min, reverse=True)
    new_entries = new_entries[: max(1, source.max_items_per_run)]

    for entry in new_entries:
        item = _ingest_entry(db, source, entry)
        db.add(item)
        if item.status == "imported":
            result.imported += 1
        else:
            result.skipped += 1

    source.last_status = "ok"
    source.last_error = ""
    source.last_fetched_at = datetime.utcnow()
    source.last_imported_count = result.imported
    db.add(source)
    db.commit()
    return result


def run_ingestion(db: Session, source_id: int | None = None) -> IngestionSummary:
    """Run the ingestion pipeline. With source_id given, runs only that
    source (still respects its `enabled` flag); otherwise runs every
    enabled FeedSource. One source's failure never prevents the others
    from running -- see `_run_source`."""
    query = db.query(FeedSource).filter(FeedSource.enabled.is_(True))
    if source_id is not None:
        query = query.filter(FeedSource.id == source_id)
    sources = query.order_by(FeedSource.order_index).all()

    summary = IngestionSummary()
    for source in sources:
        summary.results.append(_run_source(db, source))
    return summary
