"""Smoke tests: app boots, public pages render, admin auth gate works,
CSRF protection is enforced, and the blog feature (markdown rendering +
sanitization, slugs, view counting, RSS) behaves correctly."""
import os
import re

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_portfolio.db")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-password")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.markdown_utils import render_post_html  # noqa: E402

client = TestClient(app)

_CSRF_RE = re.compile(rb'name="csrf_token" value="([^"]+)"')


def _csrf_token(get_path: str) -> str:
    """Fetch a GET admin page and pull the CSRF token out of its hidden
    field, the way a real browser session would carry it from form to
    form."""
    response = client.get(get_path)
    match = _CSRF_RE.search(response.content)
    assert match, f"no csrf_token field found on {get_path}"
    return match.group(1).decode()


def _login(username: str = "admin", password: str = "test-password"):
    response = client.post(
        "/admin/login",
        data={"username": username, "password": password},
        follow_redirects=False,
    )
    assert response.status_code == 303
    return response


def test_homepage_ok():
    response = client.get("/")
    assert response.status_code == 200
    assert b"tagline" in response.content or response.status_code == 200


def test_projects_list_ok():
    response = client.get("/projects")
    assert response.status_code == 200


def test_experience_page_ok():
    response = client.get("/experience")
    assert response.status_code == 200


def test_admin_requires_login():
    response = client.get("/admin", follow_redirects=False)
    assert response.status_code in (303, 307)


def test_admin_login_flow():
    _login()
    dashboard = client.get("/admin")
    assert dashboard.status_code == 200


def test_admin_post_without_csrf_token_is_rejected():
    _login()
    # No csrf_token field at all: the request must be refused, not applied.
    response = client.post(
        "/admin/change-password",
        data={
            "current_password": "test-password",
            "new_password": "irrelevant-123",
            "confirm_password": "irrelevant-123",
        },
    )
    assert response.status_code == 400


def test_change_password_flow():
    _login()

    token = _csrf_token("/admin/change-password")
    wrong_current = client.post(
        "/admin/change-password",
        data={
            "current_password": "not-the-real-password",
            "new_password": "a-new-password-123",
            "confirm_password": "a-new-password-123",
            "csrf_token": token,
        },
    )
    assert wrong_current.status_code == 400

    token = _csrf_token("/admin/change-password")
    changed = client.post(
        "/admin/change-password",
        data={
            "current_password": "test-password",
            "new_password": "a-new-password-123",
            "confirm_password": "a-new-password-123",
            "csrf_token": token,
        },
    )
    assert changed.status_code == 200

    # log back in with the new password to confirm it took effect
    client.post("/admin/logout")
    _login(password="a-new-password-123")

    # restore the original password so the rest of the suite (and repeat
    # local runs against the same sqlite file) keep working
    token = _csrf_token("/admin/change-password")
    restored = client.post(
        "/admin/change-password",
        data={
            "current_password": "a-new-password-123",
            "new_password": "test-password",
            "confirm_password": "test-password",
            "csrf_token": token,
        },
    )
    assert restored.status_code == 200
    client.post("/admin/logout")


def test_settings_page_has_color_fields():
    _login()

    settings_page = client.get("/admin/settings")
    assert settings_page.status_code == 200
    assert b'name="background_color"' in settings_page.content
    assert b'name="text_color"' in settings_page.content
    assert b'name="accent_color"' in settings_page.content

    token = _csrf_token("/admin/settings")
    updated = client.post(
        "/admin/settings",
        data={
            "site_title": "Test Site",
            "tagline": "",
            "bio": "",
            "avatar_url": "",
            "resume_url": "",
            "footer_text": "",
            "email": "",
            "location": "",
            "github_url": "",
            "linkedin_url": "",
            "twitter_url": "",
            "background_color": "#111111",
            "text_color": "#eeeeee",
            "accent_color": "#ff00ff",
            "csrf_token": token,
        },
    )
    assert updated.status_code == 200
    assert b"#111111" in updated.content
    assert b"#eeeeee" in updated.content
    assert b"#ff00ff" in updated.content

    homepage = client.get("/")
    assert b"#111111" in homepage.content  # inline theme <style> reflects the saved colors


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Blog: markdown sanitization
# ---------------------------------------------------------------------------

def test_markdown_sanitization_strips_script_tags():
    html = render_post_html("# Hello\n\n<script>alert('xss')</script>\n\nSafe paragraph.")
    assert "<script" not in html
    assert "alert" not in html
    assert "<h1>Hello</h1>" in html
    assert "Safe paragraph." in html


def test_markdown_sanitization_strips_event_handlers():
    html = render_post_html('<img src="x.png" onerror="alert(1)">')
    assert "onerror" not in html
    assert "alert" not in html


def test_markdown_sanitization_strips_javascript_links():
    html = render_post_html("[click me](javascript:alert(1))")
    assert "javascript:" not in html


def test_markdown_sanitization_allows_safe_formatting():
    html = render_post_html("**bold** and _em_ and a [link](https://example.com)")
    assert "<strong>bold</strong>" in html
    assert "<em>em</em>" in html
    assert 'href="https://example.com"' in html


# ---------------------------------------------------------------------------
# Blog: admin CRUD + public behavior
# ---------------------------------------------------------------------------

def _create_post(title: str, published: bool = True, content: str = "Some **content**.") -> int:
    token = _csrf_token("/admin/posts/new")
    response = client.post(
        "/admin/posts/new",
        data={
            "title": title,
            "summary": "A summary.",
            "content_markdown": content,
            "tags": "python, testing",
            "published": "true" if published else "",
            "order_index": 0,
            "csrf_token": token,
        },
        follow_redirects=False,
    )
    assert response.status_code == 303
    return response


def test_admin_posts_require_login():
    client.post("/admin/logout")
    response = client.get("/admin/posts", follow_redirects=False)
    assert response.status_code in (303, 307)


def test_post_create_slug_uniqueness_and_public_visibility():
    _login()
    _create_post("My Great Post")
    _create_post("My Great Post")  # duplicate title -> must get a distinct slug

    posts_page = client.get("/admin/posts")
    assert posts_page.status_code == 200
    assert posts_page.content.count(b"My Great Post") == 2

    # both slugs resolve, and are different, on the public blog
    blog_list = client.get("/blog")
    assert blog_list.status_code == 200
    slugs = set(re.findall(rb'/blog/([a-z0-9-]+)', blog_list.content))
    assert len(slugs) >= 2


def test_unpublished_post_is_not_publicly_visible():
    _login()
    token = _csrf_token("/admin/posts/new")
    client.post(
        "/admin/posts/new",
        data={
            "title": "Secret Draft Post",
            "summary": "",
            "content_markdown": "Shh.",
            "tags": "",
            "published": "",
            "order_index": 0,
            "csrf_token": token,
        },
        follow_redirects=False,
    )
    detail = client.get("/blog/secret-draft-post")
    assert detail.status_code == 404


def test_post_validation_rejects_empty_title():
    _login()
    token = _csrf_token("/admin/posts/new")
    response = client.post(
        "/admin/posts/new",
        data={
            "title": "",
            "summary": "",
            "content_markdown": "Some content.",
            "tags": "",
            "published": "",
            "order_index": 0,
            "csrf_token": token,
        },
    )
    assert response.status_code == 400
    assert b"Title is required" in response.content


def test_view_counter_increments_without_storing_visitor_data():
    _login()
    token = _csrf_token("/admin/posts/new")
    client.post(
        "/admin/posts/new",
        data={
            "title": "Counter Test Post",
            "summary": "",
            "content_markdown": "Content for counting views.",
            "tags": "",
            "published": "true",
            "order_index": 0,
            "csrf_token": token,
        },
        follow_redirects=False,
    )

    first = client.get("/blog/counter-test-post")
    assert first.status_code == 200
    second = client.get("/blog/counter-test-post")
    assert second.status_code == 200

    analytics = client.get("/admin/analytics")
    assert analytics.status_code == 200
    assert b"Counter Test Post" in analytics.content


def test_rss_feed_is_well_formed_xml():
    import xml.etree.ElementTree as ET

    _login()
    token = _csrf_token("/admin/posts/new")
    client.post(
        "/admin/posts/new",
        data={
            "title": "RSS Feed Post",
            "summary": "Feed summary",
            "content_markdown": "Feed content.",
            "tags": "",
            "published": "true",
            "order_index": 0,
            "csrf_token": token,
        },
        follow_redirects=False,
    )

    rss = client.get("/blog/rss.xml")
    assert rss.status_code == 200
    assert "xml" in rss.headers["content-type"]
    root = ET.fromstring(rss.content)  # raises if malformed
    assert root.tag == "rss"
    channel = root.find("channel")
    assert channel is not None
    titles = [item.findtext("title") for item in channel.findall("item")]
    assert "RSS Feed Post" in titles


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------

def test_security_headers_present():
    response = client.get("/")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("referrer-policy") == "same-origin"


# ---------------------------------------------------------------------------
# Feed ingestion pipeline -- see FEED_INGESTION_PLAN.md
# ---------------------------------------------------------------------------

from app.feed_parser import FeedParseError, parse_feed  # noqa: E402
from app import ingestion as ingestion_module  # noqa: E402
from app.ingestion import run_ingestion  # noqa: E402
from app.models import FeedSource, IngestedItem, Post  # noqa: E402
from app.database import SessionLocal  # noqa: E402

_SAMPLE_RSS = b"""<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>Example Security Blog</title>
<item>
  <title>New CVE disclosed in widget</title>
  <link>https://example.com/articles/cve-widget</link>
  <guid>https://example.com/articles/cve-widget</guid>
  <pubDate>Mon, 14 Sep 2026 09:00:00 +0000</pubDate>
  <description>&lt;p&gt;A researcher found &lt;b&gt;a bug&lt;/b&gt; in widget. &lt;script&gt;alert(1)&lt;/script&gt;&lt;/p&gt;</description>
  <category>security</category>
</item>
<item>
  <title>Second article, no explicit guid</title>
  <link>https://example.com/articles/second</link>
  <pubDate>Sun, 13 Sep 2026 09:00:00 +0000</pubDate>
  <description>Plain text summary of the second article.</description>
</item>
</channel></rss>"""

_SAMPLE_ATOM = b"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <entry>
    <title>Atom entry title</title>
    <id>urn:uuid:abc-123</id>
    <link rel="alternate" href="https://example.com/atom-entry"/>
    <published>2026-09-14T10:30:00Z</published>
    <summary>Plain summary text for the atom entry.</summary>
    <category term="python"/>
  </entry>
</feed>"""


def test_feed_parser_rss():
    entries = parse_feed(_SAMPLE_RSS)
    assert len(entries) == 2
    assert entries[0].guid == "https://example.com/articles/cve-widget"
    assert entries[0].title == "New CVE disclosed in widget"
    assert entries[0].categories == ["security"]
    assert entries[0].published is not None and entries[0].published.year == 2026
    # Second item has no <guid> -- falls back to <link> as the dedup key.
    assert entries[1].guid == "https://example.com/articles/second"


def test_feed_parser_atom():
    entries = parse_feed(_SAMPLE_ATOM)
    assert len(entries) == 1
    assert entries[0].guid == "urn:uuid:abc-123"
    assert entries[0].link == "https://example.com/atom-entry"
    assert entries[0].categories == ["python"]


def test_feed_parser_rejects_malformed_xml():
    with pytest.raises(FeedParseError):
        parse_feed(b"not xml at all <<<")


def test_feed_parser_rejects_unsupported_root():
    with pytest.raises(FeedParseError):
        parse_feed(b"<rdf:RDF xmlns:rdf='urn:x'></rdf:RDF>")


def _make_source(db, feed_url="https://example.com/feed.xml", **overrides) -> FeedSource:
    source = FeedSource(
        name=overrides.pop("name", "Example Security Blog"),
        feed_url=feed_url,
        category=overrides.pop("category", "security-news"),
        extra_tags=overrides.pop("extra_tags", ""),
        enabled=overrides.pop("enabled", True),
        max_items_per_run=overrides.pop("max_items_per_run", 10),
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def test_ingestion_creates_draft_posts_with_attribution_and_tags(monkeypatch):
    monkeypatch.setattr(ingestion_module, "_fetch_feed_bytes", lambda url: _SAMPLE_RSS)
    db = SessionLocal()
    try:
        source = _make_source(db, feed_url="https://example.com/feed-a.xml")
        summary = run_ingestion(db, source_id=source.id)

        assert summary.total_imported == 2
        assert summary.results[0].status == "ok"

        posts = (
            db.query(Post)
            .filter(Post.source_name == "Example Security Blog")
            .order_by(Post.id)
            .all()
        )
        assert len(posts) == 2
        first = posts[0]
        assert first.published is False  # drafts, not auto-published
        assert first.source_url == "https://example.com/articles/cve-widget"
        assert first.source_name == "Example Security Blog"
        assert "security-news" in first.tag_list
        # The sanitizer must have stripped the <script> tag from the feed's
        # own description before it was ever stored.
        assert "<script>" not in first.content_html
        # Attribution is rendered once by blog_detail.html from
        # source_name/source_url -- it must NOT also be baked into the
        # stored body (that duplicated the attribution line on the public
        # page, caught during live verification and fixed).
        assert "originally published" not in first.content_html.lower()

        db.refresh(source)
        assert source.last_status == "ok"
        assert source.last_imported_count == 2
    finally:
        db.query(IngestedItem).filter(IngestedItem.source_id == source.id).delete()
        db.query(Post).filter(Post.source_name == "Example Security Blog").delete()
        db.query(FeedSource).filter(FeedSource.id == source.id).delete()
        db.commit()
        db.close()


def test_ingestion_is_idempotent_on_rerun(monkeypatch):
    monkeypatch.setattr(ingestion_module, "_fetch_feed_bytes", lambda url: _SAMPLE_RSS)
    db = SessionLocal()
    try:
        source = _make_source(db, feed_url="https://example.com/feed-b.xml", name="Rerun Source")
        first_run = run_ingestion(db, source_id=source.id)
        second_run = run_ingestion(db, source_id=source.id)

        assert first_run.total_imported == 2
        assert second_run.total_imported == 0  # every guid already in IngestedItem

        post_count = db.query(Post).filter(Post.source_name == "Rerun Source").count()
        assert post_count == 2  # not duplicated
    finally:
        db.query(IngestedItem).filter(IngestedItem.source_id == source.id).delete()
        db.query(Post).filter(Post.source_name == "Rerun Source").delete()
        db.query(FeedSource).filter(FeedSource.id == source.id).delete()
        db.commit()
        db.close()


def test_ingestion_records_error_without_blocking_other_sources(monkeypatch):
    def _fetch(url):
        if "broken" in url:
            raise OSError("connection refused")
        return _SAMPLE_ATOM

    monkeypatch.setattr(ingestion_module, "_fetch_feed_bytes", _fetch)
    db = SessionLocal()
    try:
        broken = _make_source(db, feed_url="https://example.com/broken-feed.xml", name="Broken Source")
        healthy = _make_source(db, feed_url="https://example.com/healthy-feed.xml", name="Healthy Source")

        summary = run_ingestion(db)

        by_name = {r.source_name: r for r in summary.results}
        assert by_name["Broken Source"].status == "error"
        assert by_name["Healthy Source"].status == "ok"
        assert by_name["Healthy Source"].imported == 1

        db.refresh(broken)
        db.refresh(healthy)
        assert broken.last_status == "error"
        assert "connection refused" in broken.last_error
        assert healthy.last_status == "ok"
    finally:
        for s in (broken, healthy):
            db.query(IngestedItem).filter(IngestedItem.source_id == s.id).delete()
            db.query(Post).filter(Post.source_name == s.name).delete()
        db.query(FeedSource).filter(FeedSource.id.in_([broken.id, healthy.id])).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()


def test_admin_sources_require_login():
    client.post("/admin/logout")
    response = client.get("/admin/sources", follow_redirects=False)
    assert response.status_code in (303, 307)


def test_admin_source_create_without_csrf_token_is_rejected():
    _login()
    response = client.post(
        "/admin/sources/new",
        data={
            "name": "No CSRF Source",
            "feed_url": "https://example.com/no-csrf-feed.xml",
            "category": "test",
            "extra_tags": "",
            "enabled": "true",
            "max_items_per_run": 10,
            "order_index": 0,
        },
    )
    assert response.status_code == 403


def test_admin_source_create_and_public_tag_filter():
    _login()
    token = _csrf_token("/admin/sources/new")
    response = client.post(
        "/admin/sources/new",
        data={
            "name": "Filter Test Source",
            "feed_url": "https://example.com/filter-test-feed.xml",
            "category": "python-news",
            "extra_tags": "",
            "enabled": "true",
            "max_items_per_run": 10,
            "order_index": 0,
            "csrf_token": token,
        },
        follow_redirects=False,
    )
    assert response.status_code == 303

    sources_page = client.get("/admin/sources")
    assert sources_page.status_code == 200
    assert b"Filter Test Source" in sources_page.content

    # A hand-written post tagged "python-news" should show up under the
    # matching /blog?tag= filter, same code path an ingested post uses.
    token = _csrf_token("/admin/posts/new")
    client.post(
        "/admin/posts/new",
        data={
            "title": "Tag Filter Demo Post",
            "summary": "",
            "content_markdown": "Content for tag filter test.",
            "tags": "python-news",
            "published": "true",
            "order_index": 0,
            "csrf_token": token,
        },
        follow_redirects=False,
    )

    filtered = client.get("/blog?tag=python-news")
    assert filtered.status_code == 200
    assert b"Tag Filter Demo Post" in filtered.content

    unrelated = client.get("/blog?tag=nonexistent-tag-xyz")
    assert b"Tag Filter Demo Post" not in unrelated.content
