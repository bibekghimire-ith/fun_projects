"""Model-level tests for Phase 5 blog content: constraints + visibility."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.blog import BlogCategory, BlogPost, BlogPostStatus, BlogTag


def _make_post(**overrides) -> BlogPost:
    defaults = {
        "title": "Test Post",
        "slug": "test-post",
        "markdown_body": "Hello world",
        "status": BlogPostStatus.DRAFT.value,
    }
    defaults.update(overrides)
    post = BlogPost(**defaults)
    db.session.add(post)
    db.session.commit()
    return post


class TestConstraints:
    def test_blog_post_slug_must_be_unique(self, app):
        _make_post(slug="dup")
        with pytest.raises(IntegrityError):
            _make_post(slug="dup")
            db.session.commit()
        db.session.rollback()

    def test_blog_category_name_and_slug_must_be_unique(self, app):
        db.session.add(BlogCategory(name="Tech", slug="tech"))
        db.session.commit()
        with pytest.raises(IntegrityError):
            db.session.add(BlogCategory(name="Tech", slug="tech-2"))
            db.session.commit()
        db.session.rollback()

    def test_blog_tag_name_must_be_unique(self, app):
        db.session.add(BlogTag(name="flask", slug="flask"))
        db.session.commit()
        with pytest.raises(IntegrityError):
            db.session.add(BlogTag(name="flask", slug="flask-2"))
            db.session.commit()
        db.session.rollback()

    def test_status_check_constraint_rejects_invalid_value(self, app):
        with pytest.raises(IntegrityError):
            _make_post(slug="bad-status", status="not-a-real-status")
        db.session.rollback()

    def test_category_deletion_sets_post_category_null_not_cascade(self, app):
        category = BlogCategory(name="News", slug="news")
        db.session.add(category)
        db.session.commit()
        post = _make_post(slug="keep-me", category_id=category.id)
        db.session.delete(category)
        db.session.commit()
        db.session.refresh(post)
        assert post.category_id is None
        assert db.session.query(BlogPost).filter_by(id=post.id).first() is not None


class TestVisibility:
    def test_draft_is_never_visible(self, app):
        post = _make_post(status=BlogPostStatus.DRAFT.value, published_at=datetime.now(UTC))
        assert post.is_publicly_visible() is False

    def test_published_with_past_published_at_is_visible(self, app):
        post = _make_post(
            slug="p1",
            status=BlogPostStatus.PUBLISHED.value,
            published_at=datetime.now(UTC) - timedelta(days=1),
        )
        assert post.is_publicly_visible() is True

    def test_scheduled_future_is_not_visible(self, app):
        post = _make_post(
            slug="p2",
            status=BlogPostStatus.SCHEDULED.value,
            scheduled_at=datetime.now(UTC) + timedelta(days=1),
        )
        assert post.is_publicly_visible() is False

    def test_scheduled_past_is_visible(self, app):
        """The core scheduling-abstraction proof: a past `scheduled_at`
        makes a post public with no background job involved - visibility
        is computed at read time."""

        post = _make_post(
            slug="p3",
            status=BlogPostStatus.SCHEDULED.value,
            scheduled_at=datetime.now(UTC) - timedelta(minutes=5),
        )
        assert post.is_publicly_visible() is True

    def test_no_timestamp_at_all_is_not_visible(self, app):
        post = _make_post(slug="p4", status=BlogPostStatus.PUBLISHED.value)
        assert post.is_publicly_visible() is False
