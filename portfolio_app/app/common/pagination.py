"""A small, dependency-free in-memory pagination helper (Phase 6).

The public blog list/category/tag/search pages all page over a Python
`list[BlogPost]` that `app/services/blog_service.py` already builds by
filtering+sorting in Python (visibility is a computed property, not a
single SQL predicate simple enough to `LIMIT/OFFSET` cleanly against every
dialect this app supports - see `blog_service._visible_query`). At this
app's scale (a single-admin, self-hosted blog - CLAUDE.md's "avoid premature
optimization"/"no external API dependency" spirit) slicing an
already-fetched, already-filtered list in Python is simpler and just as
correct as pushing pagination into SQL, and keeps one `Page` type usable by
every paginated view instead of a bespoke query per page. If the blog's
scale ever requires it, `paginate()`'s call sites are the only places that
would need to change to a SQL-level `LIMIT/OFFSET` - this module's `Page`
shape would not need to change.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class Page(Generic[T]):
    items: Sequence[T]
    page: int
    per_page: int
    total: int

    @property
    def pages(self) -> int:
        if self.per_page <= 0 or self.total <= 0:
            return 1
        return max(1, math.ceil(self.total / self.per_page))

    @property
    def has_prev(self) -> bool:
        return self.page > 1

    @property
    def has_next(self) -> bool:
        return self.page < self.pages

    @property
    def prev_num(self) -> int | None:
        return self.page - 1 if self.has_prev else None

    @property
    def next_num(self) -> int | None:
        return self.page + 1 if self.has_next else None

    @property
    def is_out_of_range(self) -> bool:
        """True once `page` is beyond the last page of a non-empty result set.

        Page 1 of a genuinely empty result set is *not* out of range (it is
        the correct "no results" empty state) - only requesting page 2+ of a
        result set that doesn't have that many pages is.
        """

        return self.page > self.pages


def paginate(items: Sequence[T], page: int, per_page: int) -> Page[T]:
    """Slice `items` (already filtered/sorted) into the requested page.

    `page` and `per_page` are trusted to already be validated/clamped
    positive integers (see `parse_pagination_args` in app/public/routes.py) -
    this function does not clamp on its own so a caller can still detect an
    out-of-range page via `Page.is_out_of_range` and 404 it.
    """

    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page
    return Page(items=items[start:end], page=page, per_page=per_page, total=total)
