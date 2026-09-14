"""Dependency-free RSS 2.0 / Atom 1.0 parser.

Deliberately does not use the `feedparser` package: see
FEED_INGESTION_PLAN.md section 4 for why (this environment has no
package-index network access to verify a new dependency installs
correctly, so the parser is built on the standard library instead --
`xml.etree.ElementTree` is enough for the subset of RSS/Atom this
pipeline needs).

Entry point: `parse_feed(raw_bytes: bytes) -> list[FeedEntry]`. Raises
`FeedParseError` on malformed XML or an unrecognized root element, so
callers can catch one exception type rather than every possible
ElementTree failure.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

# Namespaces used by Atom feeds and by the `content:encoded` extension
# some RSS feeds use for full/rich content in addition to `description`.
_ATOM_NS = "{http://www.w3.org/2005/Atom}"
_CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}"


class FeedParseError(ValueError):
    """Raised when `raw_bytes` isn't parseable as RSS or Atom."""


@dataclass
class FeedEntry:
    guid: str
    link: str
    title: str
    summary_html: str
    published: datetime | None
    categories: list[str] = field(default_factory=list)


def _text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def _parse_rss_date(value: str) -> datetime | None:
    """RSS 2.0 dates are RFC-822 (e.g. 'Mon, 14 Sep 2026 09:00:00 +0000')."""
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None


def _parse_atom_date(value: str) -> datetime | None:
    """Atom dates are ISO-8601 (e.g. '2026-09-14T09:00:00Z')."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_rss(root: ET.Element) -> list[FeedEntry]:
    channel = root.find("channel")
    if channel is None:
        raise FeedParseError("RSS feed missing <channel>")

    entries: list[FeedEntry] = []
    for item in channel.findall("item"):
        link = _text(item.find("link"))
        guid_el = item.find("guid")
        guid = _text(guid_el) or link
        if not guid:
            continue  # nothing usable to dedupe or link to

        # Prefer content:encoded (fuller HTML body some feeds provide)
        # over description; fall back to description if absent.
        content_encoded = _text(item.find(f"{_CONTENT_NS}encoded"))
        summary = content_encoded or _text(item.find("description"))

        categories = [
            _text(cat) for cat in item.findall("category") if _text(cat)
        ]

        entries.append(
            FeedEntry(
                guid=guid,
                link=link,
                title=_text(item.find("title")),
                summary_html=summary,
                published=_parse_rss_date(_text(item.find("pubDate"))),
                categories=categories,
            )
        )
    return entries


def _atom_link(entry: ET.Element) -> str:
    # Atom <link> is an empty element with an href attribute; prefer
    # rel="alternate" (or no rel, which defaults to alternate) over other
    # rel values like "self".
    fallback = ""
    for link_el in entry.findall(f"{_ATOM_NS}link"):
        rel = link_el.get("rel", "alternate")
        href = link_el.get("href", "")
        if not href:
            continue
        if rel == "alternate":
            return href
        fallback = fallback or href
    return fallback


def _parse_atom(root: ET.Element) -> list[FeedEntry]:
    entries: list[FeedEntry] = []
    for entry in root.findall(f"{_ATOM_NS}entry"):
        link = _atom_link(entry)
        guid = _text(entry.find(f"{_ATOM_NS}id")) or link
        if not guid:
            continue

        summary_el = entry.find(f"{_ATOM_NS}content")
        if summary_el is None:
            summary_el = entry.find(f"{_ATOM_NS}summary")
        summary = summary_el.text.strip() if summary_el is not None and summary_el.text else ""

        published_text = _text(entry.find(f"{_ATOM_NS}published")) or _text(
            entry.find(f"{_ATOM_NS}updated")
        )
        categories = [
            cat.get("term", "")
            for cat in entry.findall(f"{_ATOM_NS}category")
            if cat.get("term")
        ]

        entries.append(
            FeedEntry(
                guid=guid,
                link=link,
                title=_text(entry.find(f"{_ATOM_NS}title")),
                summary_html=summary,
                published=_parse_atom_date(published_text),
                categories=categories,
            )
        )
    return entries


def parse_feed(raw_bytes: bytes) -> list[FeedEntry]:
    """Parse RSS 2.0 or Atom 1.0 XML bytes into a normalized entry list,
    newest-first order as given by the feed (callers that need a strict
    sort should sort on `.published` themselves, since not every feed
    lists entries in date order)."""
    try:
        root = ET.fromstring(raw_bytes)
    except ET.ParseError as exc:
        raise FeedParseError(f"could not parse feed XML: {exc}") from exc

    tag = root.tag
    if tag == "rss" or tag.endswith("}rss"):
        return _parse_rss(root)
    if tag == f"{_ATOM_NS}feed" or tag == "feed":
        return _parse_atom(root)
    # RSS 1.0 / RDF feeds use rdf:RDF as the root -- not supported; raise a
    # clear error rather than silently returning an empty list.
    raise FeedParseError(f"unrecognized feed root element: {tag!r}")
