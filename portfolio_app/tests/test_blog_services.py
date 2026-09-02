"""Service-layer tests for Phase 5: slugging, publish/unpublish/schedule,
category/tag CRUD + assignment, and the public visibility-filtered queries.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.extensions import db
from app.models.blog import BlogPostStatus
from app.models.user import User, UserRole
from app.services import blog_category_service, blog_service, blog_tag_service


@pytest.fixture()
def author(app):
    user = User(
        email="author@example.com", password_hash="x", role=UserRole.ADMIN.value, is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return user


class TestSlugging:
    def test_create_post_generates_slug_from_title(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "Hello World!", "markdown_body": "body"}, []
        )
        assert post.slug == "hello-world"

    def test_duplicate_title_gets_a_disambiguated_slug(self, app, author):
        first = blog_service.create_post(
            author.id, {"title": "Same Title", "markdown_body": "a"}, []
        )
        second = blog_service.create_post(
            author.id, {"title": "Same Title", "markdown_body": "b"}, []
        )
        assert first.slug == "same-title"
        assert second.slug == "same-title-2"

    def test_updating_a_post_keeps_its_own_slug_available(self, app, author):
        post = blog_service.create_post(author.id, {"title": "Keep Me", "markdown_body": "a"}, [])
        updated = blog_service.update_post(post, {"title": "Keep Me", "markdown_body": "a v2"}, [])
        assert updated.slug == "keep-me"


class TestMarkdownRenderingOnSave:
    def test_rendered_body_is_populated_from_markdown_on_create(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "# Heading"}, [])
        assert "<h1" in post.rendered_body

    def test_rendered_body_is_updated_on_edit(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "one"}, [])
        blog_service.update_post(post, {"title": "T", "markdown_body": "**two**"}, [])
        assert "<strong>two</strong>" in post.rendered_body

    def test_script_tag_in_body_never_reaches_rendered_body(self, app, author):
        post = blog_service.create_post(
            author.id,
            {"title": "T", "markdown_body": "<script>alert(1)</script>"},
            [],
        )
        assert "<script" not in post.rendered_body


class TestPublishUnpublishSchedule:
    def test_new_post_is_a_draft(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        assert post.status == BlogPostStatus.DRAFT.value
        assert post.is_publicly_visible() is False

    def test_publish_sets_status_and_published_at(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        blog_service.publish_post(post)
        assert post.status == BlogPostStatus.PUBLISHED.value
        assert post.published_at is not None
        assert post.is_publicly_visible() is True

    def test_republishing_does_not_move_published_at_forward(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        blog_service.publish_post(post)
        first_published_at = post.published_at
        blog_service.publish_post(post)
        assert post.published_at == first_published_at

    def test_unpublish_returns_post_to_draft_and_hides_it(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        blog_service.publish_post(post)
        blog_service.unpublish_post(post)
        assert post.status == BlogPostStatus.DRAFT.value
        assert post.is_publicly_visible() is False

    def test_schedule_future_is_not_public(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        blog_service.schedule_post(post, datetime.now(UTC) + timedelta(days=3))
        assert post.status == BlogPostStatus.SCHEDULED.value
        assert post.is_publicly_visible() is False

    def test_schedule_past_is_public_without_any_worker(self, app, author):
        """Proves the scheduling abstraction: no cron/worker runs, visibility
        is computed purely from the stored timestamp at read time."""

        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        blog_service.schedule_post(post, datetime.now(UTC) - timedelta(minutes=1))
        assert post.is_publicly_visible() is True
        assert post in blog_service.list_public_posts()


class TestCategoryAndTagCrud:
    def test_create_category_generates_slug(self, app):
        category = blog_category_service.create_category({"name": "Deep Dives"})
        assert category.slug == "deep-dives"

    def test_duplicate_category_name_slug_disambiguated(self, app):
        blog_category_service.create_category({"name": "News", "slug": "news"})
        second = blog_category_service.create_category({"name": "News Again", "slug": "news"})
        assert second.slug == "news-2"

    def test_delete_category(self, app):
        category = blog_category_service.create_category({"name": "Temp"})
        blog_category_service.delete_category(category)
        assert blog_category_service.get_category(category.id) is None

    def test_get_or_create_tag_reuses_existing_tag(self, app):
        first = blog_tag_service.get_or_create_tag("flask")
        second = blog_tag_service.get_or_create_tag("flask")
        assert first.id == second.id

    def test_assign_tags_replaces_wholesale(self, app, author):
        post = blog_service.create_post(
            author.id, {"title": "T", "markdown_body": "x"}, ["one", "two"]
        )
        assert {t.name for t in post.tags} == {"one", "two"}
        blog_tag_service.assign_tags(post, ["three"])
        assert {t.name for t in post.tags} == {"three"}

    def test_deleting_a_tag_used_by_multiple_posts_only_removes_the_association(self, app, author):
        post_a = blog_service.create_post(
            author.id, {"title": "A", "markdown_body": "x"}, ["shared"]
        )
        post_b = blog_service.create_post(
            author.id, {"title": "B", "markdown_body": "x"}, ["shared"]
        )
        tag = blog_tag_service.get_tag_by_slug("shared")
        blog_tag_service.delete_tag(tag)
        db.session.refresh(post_a)
        db.session.refresh(post_b)
        assert post_a.tags == []
        assert post_b.tags == []


class TestFeaturedFlag:
    def test_featured_defaults_false_and_can_be_set(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        assert post.featured is False
        blog_service.update_post(post, {"title": "T", "markdown_body": "x", "featured": True}, [])
        assert post.featured is True


class TestPublicQueries:
    def test_list_public_posts_excludes_drafts_and_future_schedules(self, app, author):
        draft = blog_service.create_post(author.id, {"title": "Draft", "markdown_body": "x"}, [])
        published = blog_service.create_post(
            author.id, {"title": "Published", "markdown_body": "x"}, []
        )
        blog_service.publish_post(published)
        future = blog_service.create_post(author.id, {"title": "Future", "markdown_body": "x"}, [])
        blog_service.schedule_post(future, datetime.now(UTC) + timedelta(days=1))

        visible = blog_service.list_public_posts()
        titles = {p.title for p in visible}
        assert "Published" in titles
        assert "Draft" not in titles
        assert "Future" not in titles
        assert draft.status == BlogPostStatus.DRAFT.value  # sanity, unused otherwise

    def test_get_public_post_by_slug_404s_for_draft(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        assert blog_service.get_public_post_by_slug(post.slug) is None

    def test_get_public_post_by_slug_404s_for_unknown_slug(self, app):
        assert blog_service.get_public_post_by_slug("does-not-exist") is None

    def test_get_public_post_by_slug_succeeds_for_published(self, app, author):
        post = blog_service.create_post(author.id, {"title": "T", "markdown_body": "x"}, [])
        blog_service.publish_post(post)
        assert blog_service.get_public_post_by_slug(post.slug) is not None

    def test_list_public_posts_by_category_filters_correctly(self, app, author):
        category = blog_category_service.create_category({"name": "Cat"})
        other_category = blog_category_service.create_category({"name": "Other"})
        in_cat = blog_service.create_post(
            author.id,
            {"title": "In", "markdown_body": "x", "category_id": category.id},
            [],
        )
        blog_service.publish_post(in_cat)
        other = blog_service.create_post(
            author.id,
            {"title": "Other", "markdown_body": "x", "category_id": other_category.id},
            [],
        )
        blog_service.publish_post(other)

        results = blog_service.list_public_posts_by_category(category)
        assert [p.title for p in results] == ["In"]

    def test_list_public_posts_by_tag_filters_correctly(self, app, author):
        tagged = blog_service.create_post(
            author.id, {"title": "Tagged", "markdown_body": "x"}, ["special"]
        )
        blog_service.publish_post(tagged)
        untagged = blog_service.create_post(
            author.id, {"title": "Untagged", "markdown_body": "x"}, []
        )
        blog_service.publish_post(untagged)

        tag = blog_tag_service.get_tag_by_slug("special")
        results = blog_service.list_public_posts_by_tag(tag)
        assert [p.title for p in results] == ["Tagged"]
