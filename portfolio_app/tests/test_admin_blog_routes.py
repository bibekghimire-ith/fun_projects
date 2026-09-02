"""Admin route tests for Phase 5 blog CMS.

Covers authorization (every /admin/blog/* route requires an authenticated
admin), the create->draft->publish->schedule->unpublish flow through real
HTTP requests, category/tag CRUD, an IDOR-style 404 for an unknown post id,
and that sanitization happens through the real route (not just the service
layer directly, which tests/test_blog_services.py and
tests/test_markdown_service.py already cover).
"""

from __future__ import annotations

import uuid

from app.extensions import db
from app.models.blog import BlogCategory, BlogPost, BlogPostStatus, BlogTag


class TestAuthorization:
    def test_unauthenticated_blog_list_redirects_to_login(self, client):
        response = client.get("/admin/blog")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]

    def test_unauthenticated_cannot_create_a_post(self, client):
        response = client.post("/admin/blog/new", data={"title": "Hack", "markdown_body": "x"})
        assert response.status_code == 302
        assert db.session.query(BlogPost).count() == 0

    def test_unauthenticated_cannot_publish(self, client, admin_client):
        create = admin_client.post(
            "/admin/blog/new",
            data={"title": "Real Post", "markdown_body": "body"},
            follow_redirects=True,
        )
        assert create.status_code == 200
        post = db.session.query(BlogPost).one()

        # A fresh, unauthenticated client (not admin_client) must not be able
        # to publish it.
        from app import create_app

        anon_app = create_app("testing")
        with anon_app.test_client() as anon_client:
            response = anon_client.post(f"/admin/blog/{post.id}/publish")
            assert response.status_code in (302, 404)


class TestCreateEditDeleteCycle:
    def test_create_post_defaults_to_draft(self, admin_client):
        response = admin_client.post(
            "/admin/blog/new",
            data={"title": "My First Post", "markdown_body": "# Hello", "tags": "flask, web"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        post = db.session.query(BlogPost).one()
        assert post.slug == "my-first-post"
        assert post.status == BlogPostStatus.DRAFT.value
        assert "<h1" in post.rendered_body
        assert {t.name for t in post.tags} == {"flask", "web"}

    def test_edit_post_updates_fields_and_rerenders_body(self, admin_client):
        admin_client.post("/admin/blog/new", data={"title": "Edit Me", "markdown_body": "one"})
        post = db.session.query(BlogPost).one()

        response = admin_client.post(
            f"/admin/blog/{post.id}/edit",
            data={"title": "Edit Me", "markdown_body": "**two**"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        db.session.refresh(post)
        assert "<strong>two</strong>" in post.rendered_body

    def test_delete_post(self, admin_client):
        admin_client.post("/admin/blog/new", data={"title": "Delete Me", "markdown_body": "x"})
        post = db.session.query(BlogPost).one()
        response = admin_client.post(f"/admin/blog/{post.id}/delete", follow_redirects=True)
        assert response.status_code == 200
        assert db.session.query(BlogPost).count() == 0

    def test_unknown_post_id_404s(self, admin_client):
        response = admin_client.get(f"/admin/blog/{uuid.uuid4()}/edit")
        assert response.status_code == 404


class TestPublishUnpublishSchedule:
    def test_publish_then_unpublish(self, admin_client):
        admin_client.post("/admin/blog/new", data={"title": "Cycle", "markdown_body": "x"})
        post = db.session.query(BlogPost).one()

        response = admin_client.post(f"/admin/blog/{post.id}/publish", follow_redirects=True)
        assert response.status_code == 200
        db.session.refresh(post)
        assert post.status == BlogPostStatus.PUBLISHED.value
        assert post.published_at is not None

        response = admin_client.post(f"/admin/blog/{post.id}/unpublish", follow_redirects=True)
        assert response.status_code == 200
        db.session.refresh(post)
        assert post.status == BlogPostStatus.DRAFT.value

    def test_schedule_future_post(self, admin_client):
        admin_client.post("/admin/blog/new", data={"title": "Scheduled", "markdown_body": "x"})
        post = db.session.query(BlogPost).one()

        response = admin_client.post(
            f"/admin/blog/{post.id}/schedule",
            data={"scheduled_at": "2099-01-01T00:00"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        db.session.refresh(post)
        assert post.status == BlogPostStatus.SCHEDULED.value
        assert post.is_publicly_visible() is False


class TestPreview:
    def test_preview_route_shows_rendered_html_for_a_draft(self, admin_client):
        admin_client.post(
            "/admin/blog/new", data={"title": "Preview Me", "markdown_body": "# Draft heading"}
        )
        post = db.session.query(BlogPost).one()
        response = admin_client.get(f"/admin/blog/{post.id}/preview")
        assert response.status_code == 200
        assert b"Draft heading" in response.data

    def test_form_re_render_shows_sanitized_preview_pane(self, admin_client):
        response = admin_client.post(
            "/admin/blog/new",
            data={"title": "", "markdown_body": "<script>alert(1)</script>ok"},
        )
        # Missing title -> validation error -> form re-rendered (200), but the
        # preview pane must still be sanitized. (The page legitimately
        # contains a same-origin `<script src="...">` tag for
        # static/js/admin-ui.js - Phase 8 - so assert on the specific
        # dangerous pattern rather than banning the substring "<script"
        # outright.)
        assert response.status_code == 200
        # A bare, attribute-less <script> tag (what an unsanitized preview
        # would contain) never legitimately appears; every real <script> tag
        # on this page carries a src= attribute.
        assert b"<script>" not in response.data


class TestCategoriesAndTags:
    def test_create_edit_delete_category(self, admin_client):
        admin_client.post("/admin/blog/categories/new", data={"name": "Engineering"})
        category = db.session.query(BlogCategory).one()
        assert category.slug == "engineering"

        admin_client.post(
            f"/admin/blog/categories/{category.id}/edit",
            data={"name": "Engineering", "description": "Posts about engineering"},
        )
        db.session.refresh(category)
        assert category.description == "Posts about engineering"

        response = admin_client.post(
            f"/admin/blog/categories/{category.id}/delete", follow_redirects=True
        )
        assert response.status_code == 200
        assert db.session.query(BlogCategory).count() == 0

    def test_create_edit_delete_tag(self, admin_client):
        admin_client.post("/admin/blog/tags/new", data={"name": "security"})
        tag = db.session.query(BlogTag).one()
        assert tag.slug == "security"

        admin_client.post(f"/admin/blog/tags/{tag.id}/edit", data={"name": "appsec"})
        db.session.refresh(tag)
        assert tag.name == "appsec"

        response = admin_client.post(f"/admin/blog/tags/{tag.id}/delete", follow_redirects=True)
        assert response.status_code == 200
        assert db.session.query(BlogTag).count() == 0

    def test_unknown_category_id_404s(self, admin_client):
        response = admin_client.get(f"/admin/blog/categories/{uuid.uuid4()}/edit")
        assert response.status_code == 404


class TestFeaturedFlag:
    def test_featured_checkbox_persists(self, admin_client):
        admin_client.post(
            "/admin/blog/new",
            data={"title": "Feature Me", "markdown_body": "x", "featured": "y"},
        )
        post = db.session.query(BlogPost).one()
        assert post.featured is True
