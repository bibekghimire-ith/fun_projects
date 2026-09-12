"""Unit tests for app/common/pagination.py (Phase 6)."""

from __future__ import annotations

from app.common.pagination import paginate


class TestPaginate:
    def test_first_page_of_multiple(self):
        page = paginate(list(range(25)), page=1, per_page=10)
        assert page.items == list(range(10))
        assert page.pages == 3
        assert page.has_prev is False
        assert page.has_next is True
        assert page.prev_num is None
        assert page.next_num == 2
        assert page.is_out_of_range is False

    def test_last_page_may_be_partial(self):
        page = paginate(list(range(25)), page=3, per_page=10)
        assert page.items == [20, 21, 22, 23, 24]
        assert page.has_next is False
        assert page.has_prev is True
        assert page.is_out_of_range is False

    def test_out_of_range_page_flagged(self):
        page = paginate(list(range(25)), page=4, per_page=10)
        assert page.items == []
        assert page.is_out_of_range is True

    def test_empty_result_set_page_one_is_not_out_of_range(self):
        page = paginate([], page=1, per_page=10)
        assert page.items == []
        assert page.pages == 1
        assert page.is_out_of_range is False

    def test_empty_result_set_page_two_is_out_of_range(self):
        page = paginate([], page=2, per_page=10)
        assert page.is_out_of_range is True
