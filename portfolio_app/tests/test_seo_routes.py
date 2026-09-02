"""Route-level tests for Phase 6 discovery/SEO: pagination boundaries,
search, category/tag pagination, robots.txt, sitemap.xml, rss.xml, and
OpenGraph/Twitter metadata on a real published post.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import UTC, datetime, timedelta

import pytest

from app.extensions import db
from app.models.user import User, UserRole
from app.services import blog_category_service, blog_service

ATOM_NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


@pytest.fixture()
def author(app):
    user = User(
        email="seo-author@example.com", password_hash="x", role=UserRole.ADMIN.value, is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return user


def _publish_many(author, n, prefix="Post"):
    posts = []
    for i in range(n):
        p = blog_service.create_post(
            author.id, {"title": f"{prefix} {i}", "markdown_body": "word " * 30}, []
        )
        blog_service.publish_post(p)
        posts.append(p)
    return posts


class TestBlogListPagination:
    def test_page_one_shows_most_recent_posts(self, app, client, author):
        _publish_many(author, 15)
        response = client.get("/blog?page=1")
        assert response.status_code == 200
        assert b"Post 14" in response.data
        assert b"Post 4" not in response.data  # page 2 content

    def test_last_page_shows_remaining_posts(self, app, client, author):
        _publish_many(author, 15)
        response = client.get("/blog?page=2")
        assert response.status_code == 200
        assert b"Post 0" in response.data

    def test_out_of_range_page_404s(self, app, client, author):
        _publish_many(author, 5)
        response = client.get("/blog?page=999")
        assert response.status_code == 404

    def test_page_one_of_empty_blog_is_200(self, app, client):
        response = client.get("/blog?page=1")
        assert response.status_code == 200

    def test_custom_per_page_is_honored_and_clamped(self, app, client, author):
        _publish_many(author, 5)
        response = client.get("/blog?per_page=2")
        assert response.status_code == 200
        assert b"Post 4" in response.data
        assert b"Post 2" not in response.data


class TestBlogSearchRoute:
    def test_search_matches_are_shown(self, app, client, author):
        _publish_many(author, 1, prefix="Findable Keyword")
        response = client.get("/blog/search?q=Findable")
        assert response.status_code == 200
        assert b"Findable Keyword 0" in response.data

    def test_search_excludes_drafts(self, app, client, author):
        blog_service.create_post(
            author.id, {"title": "Draft Secretword", "markdown_body": "body"}, []
        )
        response = client.get("/blog/search?q=Secretword")
        assert b"Draft Secretword" not in response.data

    def test_no_query_shows_prompt_not_all_posts(self, app, client, author):
        _publish_many(author, 2)
        response = client.get("/blog/search")
        assert response.status_code == 200
        assert b"Post 0" not in response.data

    def test_no_match_shows_empty_state(self, app, client, author):
        _publish_many(author, 1)
        response = client.get("/blog/search?q=zzz-nonexistent-zzz")
        assert response.status_code == 200
        assert b"No posts matched" in response.data


class TestCategoryTagPagination:
    def test_category_page_paginates(self, app, client, author):
        category = blog_category_service.create_category({"name": "BigCategory"})
        for i in range(12):
            p = blog_service.create_post(
                author.id,
                {"title": f"CatPost {i}", "markdown_body": "x", "category_id": category.id},
                [],
            )
            blog_service.publish_post(p)
        page1 = client.get(f"/blog/category/{category.slug}?page=1")
        page2 = client.get(f"/blog/category/{category.slug}?page=2")
        assert page1.status_code == 200
        assert page2.status_code == 200
        assert b"CatPost 11" in page1.data
        assert b"CatPost 0" in page2.data

    def test_category_out_of_range_404s(self, app, client, author):
        category = blog_category_service.create_category({"name": "SmallCategory"})
        p = blog_service.create_post(
            author.id, {"title": "Only", "markdown_body": "x", "category_id": category.id}, []
        )
        blog_service.publish_post(p)
        response = client.get(f"/blog/category/{category.slug}?page=99")
        assert response.status_code == 404

    def test_tag_page_paginates(self, app, client, author):
        for i in range(12):
            p = blog_service.create_post(
                author.id, {"title": f"TagPost {i}", "markdown_body": "x"}, ["bigtag"]
            )
            blog_service.publish_post(p)
        page1 = client.get("/blog/tag/bigtag?page=1")
        page2 = client.get("/blog/tag/bigtag?page=2")
        assert b"TagPost 11" in page1.data
        assert b"TagPost 0" in page2.data


class TestRelatedPostsOnDetailPage:
    def test_related_posts_rendered_and_excludes_self(self, app, client, author):
        main = blog_service.create_post(
            author.id, {"title": "Main Post", "markdown_body": "x"}, ["shared"]
        )
        blog_service.publish_post(main)
        related = blog_service.create_post(
            author.id, {"title": "Related Post", "markdown_body": "x"}, ["shared"]
        )
        blog_service.publish_post(related)

        response = client.get(f"/blog/{main.slug}")
        html = response.data.decode()
        assert "Related posts" in html
        assert "Related Post" in html
        # The related-posts section never links back to the post it's shown
        # on - the card for `related` must appear, but there must not be a
        # second link to `main`'s own detail URL beyond the "back to all
        # posts" nav link already on the page.
        related_section = html.split('id="related-posts-heading"', 1)[1]
        assert f"/blog/{main.slug}" not in related_section


class TestReadingTimeRendering:
    def test_reading_time_shown_on_list_and_detail(self, app, client, author):
        post = blog_service.create_post(
            author.id, {"title": "Timed Post", "markdown_body": "word " * 500}, []
        )
        blog_service.publish_post(post)
        list_response = client.get("/blog")
        detail_response = client.get(f"/blog/{post.slug}")
        assert b"min read" in list_response.data
        assert b"min read" in detail_response.data


class TestOpenGraphAndTwitterTags:
    def test_og_and_twitter_tags_present_on_published_post(self, app, client, author):
        post = blog_service.create_post(
            author.id,
            {
                "title": "OG Post",
                "markdown_body": "content",
                "excerpt": "An excerpt for OG.",
                "cover_image_url": "https://example.com/cover.jpg",
            },
            [],
        )
        blog_service.publish_post(post)
        response = client.get(f"/blog/{post.slug}")
        html = response.data.decode()
        assert 'property="og:title" content="OG Post"' in html
        assert 'property="og:description" content="An excerpt for OG."' in html
        assert 'property="og:type" content="article"' in html
        assert 'property="og:image" content="https://example.com/cover.jpg"' in html
        assert 'property="og:site_name"' in html
        assert 'property="og:url"' in html
        assert f"/blog/{post.slug}" in html
        assert 'name="twitter:card" content="summary_large_image"' in html
        assert 'name="twitter:title" content="OG Post"' in html

    def test_og_image_omitted_when_no_cover_and_no_profile_image(self, app, client, author):
        post = blog_service.create_post(
            author.id, {"title": "No Image Post", "markdown_body": "content"}, []
        )
        blog_service.publish_post(post)
        response = client.get(f"/blog/{post.slug}")
        html = response.data.decode()
        assert "og:image" not in html
        assert 'name="twitter:card" content="summary"' in html


class TestRobotsTxt:
    def test_disallows_admin_and_auth_allows_rest(self, app, client):
        response = client.get("/robots.txt")
        assert response.status_code == 200
        assert response.mimetype == "text/plain"
        body = response.data.decode()
        assert "Disallow: /admin/" in body
        assert "Disallow: /auth/" in body
        assert "Allow: /" in body
        assert "Sitemap:" in body
        assert "/sitemap.xml" in body


class TestSitemap:
    def test_sitemap_is_valid_xml_and_lists_public_urls(self, app, client, author):
        post = blog_service.create_post(
            author.id, {"title": "Sitemap Post", "markdown_body": "x"}, []
        )
        blog_service.publish_post(post)
        draft = blog_service.create_post(
            author.id, {"title": "Sitemap Draft", "markdown_body": "x"}, []
        )

        response = client.get("/sitemap.xml")
        assert response.status_code == 200
        assert response.mimetype == "application/xml"
        body = response.data.decode()
        root = ET.fromstring(body)  # raises if malformed
        locs = [el.text for el in root.findall(".//s:loc", ATOM_NS)]

        assert any(loc.endswith("/blog") for loc in locs)
        assert any(loc.endswith(f"/blog/{post.slug}") for loc in locs)
        assert any(loc.endswith("/") for loc in locs)  # home page
        assert not any(f"/blog/{draft.slug}" in loc for loc in locs)
        assert not any("/admin" in loc for loc in locs)
        assert not any("/auth" in loc for loc in locs)

    def test_sitemap_includes_category_and_tag_pages_with_public_posts_only(
        self, app, client, author
    ):
        category = blog_category_service.create_category({"name": "SiteCat"})
        empty_category = blog_category_service.create_category({"name": "EmptyCat"})
        post = blog_service.create_post(
            author.id,
            {"title": "Cat Sitemap Post", "markdown_body": "x", "category_id": category.id},
            ["sitetag"],
        )
        blog_service.publish_post(post)

        response = client.get("/sitemap.xml")
        body = response.data.decode()
        assert f"/blog/category/{category.slug}" in body
        assert f"/blog/category/{empty_category.slug}" not in body
        assert "/blog/tag/sitetag" in body


class TestRssFeed:
    def test_rss_is_valid_xml_with_expected_fields(self, app, client, author):
        post = blog_service.create_post(
            author.id,
            {"title": "RSS Post", "markdown_body": "x", "excerpt": "RSS excerpt."},
            [],
        )
        blog_service.publish_post(post)

        response = client.get("/rss.xml")
        assert response.status_code == 200
        assert response.mimetype == "application/rss+xml"
        root = ET.fromstring(response.data.decode())
        channel = root.find("channel")
        assert channel is not None
        items = channel.findall("item")
        assert len(items) == 1
        item = items[0]
        assert item.find("title").text == "RSS Post"
        assert item.find("link").text.endswith(f"/blog/{post.slug}")
        assert item.find("pubDate") is not None
        assert item.find("description").text == "RSS excerpt."

    def test_rss_excludes_drafts_and_future_scheduled_posts(self, app, client, author):
        blog_service.create_post(author.id, {"title": "Draft RSS", "markdown_body": "x"}, [])
        future = blog_service.create_post(
            author.id, {"title": "Future RSS", "markdown_body": "x"}, []
        )
        blog_service.schedule_post(future, datetime.now(UTC) + timedelta(days=5))

        response = client.get("/rss.xml")
        body = response.data.decode()
        assert "Draft RSS" not in body
        assert "Future RSS" not in body

    def test_rss_includes_past_scheduled_post(self, app, client, author):
        post = blog_service.create_post(
            author.id, {"title": "Past Scheduled RSS", "markdown_body": "x"}, []
        )
        blog_service.schedule_post(post, datetime.now(UTC) - timedelta(hours=2))
        response = client.get("/rss.xml")
        assert "Past Scheduled RSS" in response.data.decode()
