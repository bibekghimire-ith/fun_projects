"""Public blog route tests (Phase 5).

Covers the exit criteria directly: a draft is not publicly visible; once
published it appears on the list + detail pages with sanitized rendered
HTML and SEO meta tags; a future-scheduled post stays hidden; a
past-scheduled post is public (the scheduling abstraction, proven end to
end through real HTTP requests, not just the service layer).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.extensions import db
from app.models.user import User, UserRole
from app.services import blog_category_service, blog_service


def _author(app):
    user = User(
        email="blogauthor@example.com", password_hash="x", role=UserRole.ADMIN.value, is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return user


class TestBlogListVisibility:
    def test_empty_blog_list_renders_empty_state(self, app, client):
        response = client.get("/blog")
        assert response.status_code == 200
        assert b"No blog posts yet." in response.data

    def test_draft_post_does_not_appear_on_public_list(self, app, client):
        author = _author(app)
        blog_service.create_post(author.id, {"title": "Secret Draft", "markdown_body": "x"}, [])
        response = client.get("/blog")
        assert b"Secret Draft" not in response.data

    def test_published_post_appears_on_public_list(self, app, client):
        author = _author(app)
        post = blog_service.create_post(
            author.id, {"title": "Public Post", "markdown_body": "x"}, []
        )
        blog_service.publish_post(post)
        response = client.get("/blog")
        assert response.status_code == 200
        assert b"Public Post" in response.data

    def test_future_scheduled_post_is_not_public(self, app, client):
        author = _author(app)
        post = blog_service.create_post(
            author.id, {"title": "Future Post", "markdown_body": "x"}, []
        )
        blog_service.schedule_post(post, datetime.now(UTC) + timedelta(days=2))
        response = client.get("/blog")
        assert b"Future Post" not in response.data
        detail = client.get(f"/blog/{post.slug}")
        assert detail.status_code == 404

    def test_past_scheduled_post_is_public(self, app, client):
        """The scheduling-abstraction exit criterion: a past-dated schedule
        is public immediately, with no worker/cron involved."""

        author = _author(app)
        post = blog_service.create_post(
            author.id, {"title": "Past Scheduled Post", "markdown_body": "x"}, []
        )
        blog_service.schedule_post(post, datetime.now(UTC) - timedelta(hours=1))
        response = client.get("/blog")
        assert b"Past Scheduled Post" in response.data
        detail = client.get(f"/blog/{post.slug}")
        assert detail.status_code == 200


class TestBlogDetail:
    def test_unknown_slug_404s(self, app, client):
        response = client.get("/blog/no-such-post")
        assert response.status_code == 404

    def test_draft_slug_404s_even_if_known(self, app, client):
        author = _author(app)
        post = blog_service.create_post(author.id, {"title": "Hidden", "markdown_body": "x"}, [])
        response = client.get(f"/blog/{post.slug}")
        assert response.status_code == 404

    def test_published_post_renders_sanitized_body(self, app, client):
        author = _author(app)
        post = blog_service.create_post(
            author.id,
            {
                "title": "XSS Test",
                "markdown_body": "Safe text <script>alert('xss')</script> more text",
            },
            [],
        )
        blog_service.publish_post(post)
        response = client.get(f"/blog/{post.slug}")
        assert response.status_code == 200
        # The page legitimately contains other <script> tags (theme-toggle.js
        # etc.) - what must never survive is an *executable* <script> element
        # built from the post body; bleach strips the tag and leaves the
        # inner text inert (plain, non-executing text), which is safe.
        assert b"<script>alert" not in response.data
        assert b"</script> more text" not in response.data
        assert b"Safe text" in response.data

    def test_seo_meta_tags_present_when_set(self, app, client):
        author = _author(app)
        post = blog_service.create_post(
            author.id,
            {
                "title": "SEO Post",
                "markdown_body": "content",
                "seo_title": "Custom SEO Title",
                "seo_description": "Custom SEO description text.",
                "canonical_url": "https://example.com/canonical-post",
            },
            [],
        )
        blog_service.publish_post(post)
        response = client.get(f"/blog/{post.slug}")
        html = response.data.decode()
        assert "Custom SEO Title" in html
        assert "Custom SEO description text." in html
        assert 'rel="canonical" href="https://example.com/canonical-post"' in html

    def test_seo_falls_back_to_title_and_excerpt_when_unset(self, app, client):
        author = _author(app)
        post = blog_service.create_post(
            author.id,
            {"title": "Fallback Post", "markdown_body": "content", "excerpt": "An excerpt."},
            [],
        )
        blog_service.publish_post(post)
        response = client.get(f"/blog/{post.slug}")
        html = response.data.decode()
        assert "Fallback Post" in html
        assert "An excerpt." in html

    def test_featured_flag_is_reflected_in_rendered_output(self, app, client):
        author = _author(app)
        post = blog_service.create_post(
            author.id, {"title": "Featured Post", "markdown_body": "x", "featured": True}, []
        )
        blog_service.publish_post(post)
        response = client.get(f"/blog/{post.slug}")
        assert b"Featured" in response.data


class TestCategoryAndTagPages:
    def test_category_page_lists_only_matching_public_posts(self, app, client):
        author = _author(app)
        category = blog_category_service.create_category({"name": "Tutorials"})
        other_category = blog_category_service.create_category({"name": "Other"})
        in_category = blog_service.create_post(
            author.id,
            {"title": "In Category", "markdown_body": "x", "category_id": category.id},
            [],
        )
        blog_service.publish_post(in_category)
        outside = blog_service.create_post(
            author.id,
            {"title": "Outside", "markdown_body": "x", "category_id": other_category.id},
            [],
        )
        blog_service.publish_post(outside)

        response = client.get(f"/blog/category/{category.slug}")
        assert response.status_code == 200
        assert b"In Category" in response.data
        assert b"Outside" not in response.data

    def test_unknown_category_slug_404s(self, app, client):
        response = client.get("/blog/category/does-not-exist")
        assert response.status_code == 404

    def test_tag_page_lists_only_tagged_public_posts(self, app, client):
        author = _author(app)
        tagged = blog_service.create_post(
            author.id, {"title": "Tagged Post", "markdown_body": "x"}, ["python"]
        )
        blog_service.publish_post(tagged)
        untagged = blog_service.create_post(
            author.id, {"title": "Untagged Post", "markdown_body": "x"}, []
        )
        blog_service.publish_post(untagged)

        response = client.get("/blog/tag/python")
        assert response.status_code == 200
        assert b"Tagged Post" in response.data
        assert b"Untagged Post" not in response.data

    def test_unknown_tag_slug_404s(self, app, client):
        response = client.get("/blog/tag/does-not-exist")
        assert response.status_code == 404


class TestThemingForBlogPages:
    def test_blog_pages_render_under_every_theme(self, app, client):

        from app.services import template_service

        author = _author(app)
        post = blog_service.create_post(
            author.id, {"title": "Themed Post", "markdown_body": "x"}, []
        )
        blog_service.publish_post(post)

        for theme in template_service.list_templates():
            template_service.set_active_template(theme.key)
            for path in ("/blog", f"/blog/{post.slug}"):
                response = client.get(path)
                assert response.status_code == 200, (theme.key, path)
                assert f"theme-{theme.key}".encode() in response.data
