"""Markdown rendering + HTML sanitization (Phase 5).

Per CLAUDE.md rule #14 ("Sanitize rendered blog HTML") - these tests
actually attempt XSS payloads through `render_markdown` and assert the
dangerous parts are gone from the output, not merely that *something* was
returned.
"""

from __future__ import annotations

from app.services.markdown_service import render_markdown


def test_plain_markdown_renders_expected_html():
    html = render_markdown("# Hello\n\nSome **bold** text.")
    assert "<h1" in html
    assert "<strong>bold</strong>" in html


def test_script_tag_is_stripped():
    html = render_markdown("Hello <script>alert('xss')</script> world")
    # The tag itself must be gone (no executable <script> element survives);
    # bleach.clean(strip=True) leaves the inner text as inert plain text
    # rather than raising, which is fine - it can never execute as markup.
    assert "<script" not in html
    assert "</script>" not in html


def test_on_event_handler_attribute_is_stripped():
    html = render_markdown('<img src="x.png" onerror="alert(1)">')
    assert "onerror" not in html
    assert "alert(1)" not in html


def test_javascript_url_is_stripped():
    html = render_markdown("[click me](javascript:alert('xss'))")
    assert "javascript:" not in html


def test_data_url_scheme_is_stripped_from_image_src():
    html = render_markdown("![x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)")
    assert "data:text/html" not in html


def test_iframe_is_stripped():
    html = render_markdown('<iframe src="https://evil.example"></iframe>')
    assert "<iframe" not in html


def test_style_tag_is_stripped():
    html = render_markdown("<style>body{display:none}</style>text")
    assert "<style" not in html


def test_safe_link_and_image_are_preserved():
    html = render_markdown("[Example](https://example.com) and ![alt](https://example.com/x.png)")
    assert 'href="https://example.com"' in html
    assert 'src="https://example.com/x.png"' in html


def test_fenced_code_block_gets_syntax_highlighting_markup():
    html = render_markdown("```python\ndef f():\n    return 1\n```")
    assert "codehilite" in html
    assert "<pre" in html


def test_empty_input_returns_empty_string():
    assert render_markdown("") == ""
    assert render_markdown(None) == ""  # type: ignore[arg-type]
