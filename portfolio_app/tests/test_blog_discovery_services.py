"""Service-layer tests for Phase 6: search, pagination wrappers, related
posts, and reading-time estimation.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.extensions import db
from app.models.user import User, UserRole
from app.services import blog_category_service, blog_service


@pytest.fixture()
def author(app):
    user = User(
        email="discovery-author@example.com",
        password_hash="x",
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()
    return user


class TestSearch:
    def test_matches_title(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Flask Security Guide", "markdown_body": "body"}, []
        )
        blog_service.publish_post(post)
        results = blog_service.search_public_posts("security")
        assert post in results

    def test_matches_excerpt(self, app, author):
        post = blog_service.create_post(
            author.id,
            {"title": "T1", "markdown_body": "body", "excerpt": "a rare word: platypus"},
            [],
        )
        blog_service.publish_post(post)
        assert post in blog_service.search_public_posts("platypus")

    def test_matches_body(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "T2", "markdown_body": "unique-token-xyz appears here"}, []
        )
        blog_service.publish_post(post)
        assert post in blog_service.search_public_posts("unique-token-xyz")

    def test_no_match_returns_empty(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Nothing relevant", "markdown_body": "body"}, []
        )
        blog_service.publish_post(post)
        assert blog_service.search_public_posts("zzz-no-such-term") == []

    def test_blank_query_returns_empty(self, app, author):
        assert blog_service.search_public_posts("") == []
        assert blog_service.search_public_posts("   ") == []

    def test_excludes_drafts(self, app, author):
        draft = blog_service.create_post(
            author.id, {"title": "Draft with keyword unicorn", "markdown_body": "body"}, []
        )
        results = blog_service.search_public_posts("unicorn")
        assert draft not in results

    def test_excludes_future_scheduled_posts(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Future keyword giraffe", "markdown_body": "body"}, []
        )
        blog_service.schedule_post(post, datetime.now(UTC) + timedelta(days=1))
        assert post not in blog_service.search_public_posts("giraffe")

    def test_case_insensitive(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "CaSe Sensitive Test", "markdown_body": "body"}, []
        )
        blog_service.publish_post(post)
        assert post in blog_service.search_public_posts("case sensitive")


class TestPaginationWrappers:
    def _published(self, author, n):
        posts = []
        for i in range(n):
            p = blog_service.create_post(
                author.id, {"title": f"Paged Post {i}", "markdown_body": "body"}, []
            )
            blog_service.publish_post(p)
            posts.append(p)
        return posts

    def test_list_public_posts_page_first_page(self, app, author):
        self._published(author, 15)
        page = blog_service.list_public_posts_page(1, 10)
        assert len(page.items) == 10
        assert page.total == 15
        assert page.pages == 2
        assert page.has_next is True

    def test_list_public_posts_page_last_page_partial(self, app, author):
        self._published(author, 15)
        page = blog_service.list_public_posts_page(2, 10)
        assert len(page.items) == 5
        assert page.has_next is False

    def test_list_public_posts_page_out_of_range(self, app, author):
        self._published(author, 5)
        page = blog_service.list_public_posts_page(5, 10)
        assert page.is_out_of_range is True

    def test_category_page_only_includes_matching_public_posts(self, app, author):
        category = blog_category_service.create_category({"name": "PagedCat"})
        for i in range(3):
            p = blog_service.create_post(
                author.id,
                {"title": f"Cat {i}", "markdown_body": "body", "category_id": category.id},
                [],
            )
            blog_service.publish_post(p)
        page = blog_service.list_public_posts_by_category_page(category, 1, 2)
        assert page.total == 3
        assert len(page.items) == 2

    def test_search_page_paginates(self, app, author):
        for i in range(12):
            p = blog_service.create_post(
                author.id, {"title": f"Searchable Term {i}", "markdown_body": "body"}, []
            )
            blog_service.publish_post(p)
        page = blog_service.search_public_posts_page("Searchable", 1, 10)
        assert page.total == 12
        assert len(page.items) == 10


class TestRelatedPosts:
    def test_excludes_current_post(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Self", "markdown_body": "body"}, ["shared"]
        )
        blog_service.publish_post(post)
        assert post not in blog_service.related_posts(post)

    def test_shared_tag_is_related(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Main", "markdown_body": "body"}, ["python", "flask"]
        )
        blog_service.publish_post(post)
        other = blog_service.create_post(
            author.id, {"title": "Other", "markdown_body": "body"}, ["python"]
        )
        blog_service.publish_post(other)
        unrelated = blog_service.create_post(
            author.id, {"title": "Unrelated", "markdown_body": "body"}, ["golang"]
        )
        blog_service.publish_post(unrelated)

        related = blog_service.related_posts(post)
        assert other in related
        assert unrelated not in related

    def test_shared_category_is_related_with_no_tag_overlap(self, app, author):
        category = blog_category_service.create_category({"name": "RelCat"})
        post = blog_service.create_post(
            author.id,
            {"title": "Main2", "markdown_body": "body", "category_id": category.id},
            [],
        )
        blog_service.publish_post(post)
        same_cat = blog_service.create_post(
            author.id,
            {"title": "SameCat", "markdown_body": "body", "category_id": category.id},
            [],
        )
        blog_service.publish_post(same_cat)
        assert same_cat in blog_service.related_posts(post)

    def test_excludes_draft_and_future_scheduled_candidates(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Main3", "markdown_body": "body"}, ["shared-tag"]
        )
        blog_service.publish_post(post)
        draft_candidate = blog_service.create_post(
            author.id, {"title": "Draft Candidate", "markdown_body": "body"}, ["shared-tag"]
        )
        future_candidate = blog_service.create_post(
            author.id, {"title": "Future Candidate", "markdown_body": "body"}, ["shared-tag"]
        )
        blog_service.schedule_post(future_candidate, datetime.now(UTC) + timedelta(days=3))

        related = blog_service.related_posts(post)
        assert draft_candidate not in related
        assert future_candidate not in related

    def test_no_overlap_returns_empty(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Lonely", "markdown_body": "body"}, ["onlytag"]
        )
        blog_service.publish_post(post)
        unrelated = blog_service.create_post(
            author.id, {"title": "Other Lonely", "markdown_body": "body"}, ["differenttag"]
        )
        blog_service.publish_post(unrelated)
        assert blog_service.related_posts(post) == []

    def test_respects_limit(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Main4", "markdown_body": "body"}, ["popular"]
        )
        blog_service.publish_post(post)
        for i in range(5):
            p = blog_service.create_post(
                author.id, {"title": f"Related {i}", "markdown_body": "body"}, ["popular"]
            )
            blog_service.publish_post(p)
        assert len(blog_service.related_posts(post, limit=3)) == 3


class TestReadingTime:
    def test_short_post_rounds_up_to_one_minute(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Short", "markdown_body": "Just a few words here."}, []
        )
        assert blog_service.reading_time_minutes(post) == 1

    def test_long_post_scales_with_word_count(self, app, author):
        long_body = " ".join(["word"] * 900)  # ~900 words / 225 wpm = 4 minutes
        post = blog_service.create_post(
            author.id, {"title": "Long", "markdown_body": long_body}, []
        )
        assert blog_service.reading_time_minutes(post) == 4

    def test_empty_body_is_still_at_least_one_minute(self, app, author):
        post = blog_service.create_post(author.id, {"title": "Empty", "markdown_body": ""}, [])
        assert blog_service.reading_time_minutes(post) == 1

    def test_html_tags_are_not_counted_as_words(self, app, author):
        # rendered_body wraps the same word count in HTML markup; the
        # estimate should be based on stripped text word count, not raw
        # markup length.
        post = blog_service.create_post(
            author.id, {"title": "Formatted", "markdown_body": "**bold** and *italic* text"}, []
        )
        assert blog_service.reading_time_minutes(post) == 1
