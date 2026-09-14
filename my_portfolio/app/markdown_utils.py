"""Markdown -> sanitized HTML, rendered once (at save time) and cached.

This is the one part of the blog feature that can introduce stored XSS if
handled carelessly, so it gets its own module and its own explicit
allowlist rather than trusting Python-Markdown's output directly.

Flow: admin submits Markdown -> render_post_html() converts it to HTML via
python-markdown -> the HTML is sanitized via nh3 against a fixed allowlist
-> the sanitized HTML (never the raw markdown-library output) is what gets
stored in Post.content_html and, later, rendered with `| safe` in
templates. Public routes never touch python-markdown or nh3 directly —
they only ever read the already-sanitized content_html.
"""
import markdown
import nh3

_MD_EXTENSIONS = ["fenced_code", "tables", "toc", "codehilite", "sane_lists"]
_MD_EXTENSION_CONFIGS = {
    "codehilite": {"guess_lang": False, "css_class": "codehilite"},
}

# Explicit allowlist: everything not listed here is stripped, not escaped.
# No <script>, no inline event handlers, no `style` attribute, no raw
# <iframe>/<object>/<embed>.
_ALLOWED_TAGS = {
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "em", "b", "i", "s", "del", "code", "pre",
    "blockquote", "ul", "ol", "li",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div",
}
_ALLOWED_ATTRIBUTES = {
    # "rel" is deliberately NOT listed here: nh3's link_rel= option below
    # sets rel="noopener noreferrer" on every link itself, and ammonia
    # (nh3's Rust backend) asserts at runtime that "rel" is not *also* in
    # the attribute allowlist for "a" — having both crashes the process
    # (a Rust panic, not a catchable Python exception) on the very first
    # post save. See link_rel in the nh3.clean() call below.
    "a": {"href", "title"},
    "img": {"src", "alt", "title"},
    "code": {"class"},  # codehilite / language-* classes for syntax highlighting
    "span": {"class"},
    "div": {"class"},
    "th": {"align"},
    "td": {"align"},
}
_ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}


def render_post_html(markdown_text: str) -> str:
    """Render Markdown to sanitized HTML, safe to store and later render
    with `| safe` in a template. Never call this on the request path for
    public routes — only from the admin create/update handlers."""
    raw_html = markdown.markdown(
        markdown_text or "",
        extensions=_MD_EXTENSIONS,
        extension_configs=_MD_EXTENSION_CONFIGS,
        output_format="html5",
    )

    clean_html = nh3.clean(
        raw_html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        url_schemes=_ALLOWED_URL_SCHEMES,
        link_rel="noopener noreferrer",
    )
    return clean_html


def sanitize_external_html(raw_html: str) -> str:
    """Sanitize HTML that did NOT come from python-markdown -- specifically,
    a feed entry's own summary/description HTML (see app/ingestion.py).
    Same allowlist and nh3 backend as render_post_html(), just skipping the
    Markdown-rendering step since the input is already HTML, not Markdown.
    Never trust feed content any less than admin-authored Markdown: this
    goes through the identical sanitizer before it's ever stored."""
    return nh3.clean(
        raw_html or "",
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        url_schemes=_ALLOWED_URL_SCHEMES,
        link_rel="noopener noreferrer",
    )
