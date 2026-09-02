"""Markdown -> sanitized HTML rendering for blog posts.

Per CLAUDE.md rule #14 ("Sanitize rendered blog HTML") and "Do not render
raw unsanitized HTML from blog content": `render_markdown()` is the single
function in this codebase allowed to turn admin-authored Markdown into HTML,
and it always runs the result through `bleach.clean()` before returning it -
there is no code path anywhere that renders `markdown_body` (or any other
Markdown text) directly as `| safe` HTML.

Library choice (see docs/DECISIONS.md): `markdown` (widely-used, stdlib-like
API, first-class `codehilite`/`fenced_code` extensions for Pygments-backed
syntax highlighting - CLAUDE.md's Blog/CMS "syntax-highlighted code"
requirement) + `bleach` (an allowlist HTML sanitizer built specifically for
"take this untrusted-ish HTML and make it safe to render", rather than
markdown-it-py/nh3 which would need more assembly for the same guarantee).

Sanitize-on-save, not sanitize-on-render (see docs/DECISIONS.md): the
service layer (app/services/blog_service.py) calls `render_markdown()` once
per create/update and stores the sanitized result in `BlogPost.rendered_body`
- matching docs/DATABASE_DESIGN.md's "rendered_body optional/cacheable" hint
- so every public page request renders a plain, pre-sanitized HTML string
with zero per-request Markdown/sanitization cost, and the admin preview
endpoint reuses this same function against not-yet-saved form input.
"""

from __future__ import annotations

import bleach
import markdown as _markdown

_MARKDOWN_EXTENSIONS = [
    "extra",  # tables, fenced code, footnotes, etc.
    "codehilite",  # Pygments-backed syntax highlighting for fenced code blocks
    "toc",
    "sane_lists",
]

_MARKDOWN_EXTENSION_CONFIGS = {
    "codehilite": {"guess_lang": False, "css_class": "codehilite"},
}

# Allowlist: everything Markdown's supported extensions can plausibly emit
# for prose + code + tables, and nothing that can execute script or load
# arbitrary content (no <script>, <iframe>, <style>, <object>, <form>, event
# handler attributes, or non-http(s)/mailto URLs).
ALLOWED_TAGS = [
    "p",
    "br",
    "hr",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "span",
    "div",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "sup",
    "sub",
]

ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "rel"],
    "img": ["src", "alt", "title", "loading"],
    "span": ["class"],
    "div": ["class"],
    "code": ["class"],
    "pre": ["class"],
    "th": ["align"],
    "td": ["align"],
}

# Only these URL schemes survive in href/src attributes - blocks
# `javascript:`/`data:`/etc.-based XSS vectors.
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def render_markdown(markdown_text: str) -> str:
    """Render Markdown to sanitized, safe-to-embed HTML.

    Always returns a string (empty string for empty/None input); never
    raises on malformed/malicious input - sanitization strips what it
    doesn't allow rather than erroring.
    """

    if not markdown_text:
        return ""

    raw_html = _markdown.markdown(
        markdown_text,
        extensions=_MARKDOWN_EXTENSIONS,
        extension_configs=_MARKDOWN_EXTENSION_CONFIGS,
        output_format="html",
    )
    cleaned = bleach.clean(
        raw_html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )
    # bleach.clean already strips disallowed tags/attributes (including
    # `javascript:`-scheme links and any `on*` handler attribute, since
    # neither is in the allowlists above); linkify is intentionally not
    # applied - Markdown/authors already write explicit `[text](url)` links.
    return cleaned
