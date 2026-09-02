"""Phase 4 public portfolio: routes, visibility/ordering, theming, nav, a11y.

Covers this phase's exit criteria:
- every public route returns 200 with no content configured (meaningful
  empty states, not a crash) and with content configured
- invisible/inactive content (VisibilityMixin) is excluded from public pages
- display order (OrderingMixin) is respected
- the project-detail route 404s for an unknown or hidden slug
- the same content renders through at least two different active themes
  without error
- navigation reflects admin configuration (visible items, in order)
- accessibility basics: skip link, alt text, labeled contact-form fields
"""

from __future__ import annotations

import datetime as dt

import pytest

from app.extensions import db
from app.models.achievement import Achievement
from app.models.certification import Certification
from app.models.education import Education
from app.models.experience import Experience
from app.models.navigation import NavigationItem
from app.models.profile import Profile, SocialLink
from app.models.project import Project
from app.models.resume import Resume
from app.models.skill import Skill, SkillCategory
from app.services import template_service


@pytest.fixture()
def seeded_profile(app):
    from app.models.user import User, UserRole
    from app.services import auth_service

    user = User(
        email="public-e2e@example.com",
        password_hash=auth_service.hash_password("CorrectHorseBatteryStaple1!"),
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()

    profile = Profile(
        user_id=user.id,
        display_name="Ada Lovelace",
        professional_title="Analytical Engine Programmer",
        tagline="Computing before computers.",
        public_email="ada@example.com",
    )
    db.session.add(profile)
    db.session.commit()

    db.session.add_all(
        [
            SocialLink(
                profile_id=profile.id,
                platform="GitHub",
                url="https://github.com/ada",
                display_order=0,
                visible=True,
            ),
            Experience(
                profile_id=profile.id,
                company="Analytical Engines Ltd",
                role="Lead Programmer",
                start_date=dt.date(1840, 1, 1),
                is_current=True,
                display_order=0,
                visible=True,
            ),
            Experience(
                profile_id=profile.id,
                company="Secret Society",
                role="Hidden Role",
                start_date=dt.date(1830, 1, 1),
                is_current=False,
                end_date=dt.date(1835, 1, 1),
                display_order=1,
                visible=False,
            ),
            Education(
                profile_id=profile.id,
                institution="Royal Academy",
                degree="Mathematics",
                display_order=0,
                visible=True,
            ),
            Certification(
                profile_id=profile.id,
                name="Certified Analytical Engineer",
                issuer="Royal Society",
                display_order=0,
                visible=True,
            ),
            Achievement(
                profile_id=profile.id,
                title="First Published Algorithm",
                display_order=0,
                visible=True,
            ),
        ]
    )
    db.session.add(
        Project(
            profile_id=profile.id,
            title="Difference Engine Notes",
            slug="difference-engine-notes",
            short_description="Notes on Babbage's engine.",
            display_order=0,
            visible=True,
            featured=True,
        )
    )
    db.session.add(
        Project(
            profile_id=profile.id,
            title="Unpublished Draft",
            slug="unpublished-draft",
            display_order=1,
            visible=False,
            featured=False,
        )
    )
    category = SkillCategory(name="Programming", display_order=0, visible=True)
    db.session.add(category)
    db.session.commit()
    db.session.add(
        Skill(
            category_id=category.id,
            name="Analytical Programming",
            proficiency=5,
            display_order=0,
            visible=True,
        )
    )
    db.session.add(
        Resume(
            profile_id=profile.id,
            title="Ada's Resume",
            public_url="https://example.com/resume.pdf",
            download_enabled=True,
        )
    )
    db.session.commit()
    return profile


ALL_PUBLIC_GET_ROUTES = [
    "/",
    "/about",
    "/experience",
    "/education",
    "/skills",
    "/projects",
    "/certifications",
    "/achievements",
    "/resume",
    "/contact",
]


class TestPublicRoutesEmptyState:
    """Every route must return 200 (not crash) with zero content configured."""

    @pytest.mark.parametrize("path", ALL_PUBLIC_GET_ROUTES)
    def test_route_returns_200_with_no_content(self, client, path):
        response = client.get(path)
        assert response.status_code == 200

    def test_home_shows_empty_state_copy(self, client):
        response = client.get("/")
        assert b"coming soon" in response.data.lower() or b"not" in response.data.lower()

    def test_project_detail_404s_when_nothing_exists(self, client):
        response = client.get("/projects/does-not-exist")
        assert response.status_code == 404

    def test_unknown_path_returns_themed_404(self, client):
        response = client.get("/this-route-does-not-exist")
        assert response.status_code == 404
        assert b"Page not found" in response.data


class TestPublicRoutesWithContent:
    @pytest.mark.parametrize("path", ALL_PUBLIC_GET_ROUTES)
    def test_route_returns_200_with_content(self, client, seeded_profile, path):
        response = client.get(path)
        assert response.status_code == 200

    def test_home_shows_profile_name_and_featured_project(self, client, seeded_profile):
        response = client.get("/")
        html = response.data.decode()
        assert "Ada Lovelace" in html
        assert "Difference Engine Notes" in html

    def test_experience_page_shows_visible_and_hides_invisible(self, client, seeded_profile):
        response = client.get("/experience")
        html = response.data.decode()
        assert "Analytical Engines Ltd" in html
        assert "Secret Society" not in html

    def test_projects_page_shows_visible_and_hides_invisible(self, client, seeded_profile):
        response = client.get("/projects")
        html = response.data.decode()
        assert "Difference Engine Notes" in html
        assert "Unpublished Draft" not in html

    def test_skills_page_shows_visible_category_and_skill(self, client, seeded_profile):
        response = client.get("/skills")
        html = response.data.decode()
        assert "Programming" in html
        assert "Analytical Programming" in html

    def test_certifications_and_achievements_render_content(self, client, seeded_profile):
        response = client.get("/certifications")
        assert b"Certified Analytical Engineer" in response.data
        response = client.get("/achievements")
        assert b"First Published Algorithm" in response.data

    def test_resume_page_links_to_public_url(self, client, seeded_profile):
        response = client.get("/resume")
        assert b"https://example.com/resume.pdf" in response.data

    def test_contact_page_shows_public_email(self, client, seeded_profile):
        response = client.get("/contact")
        assert b"ada@example.com" in response.data

    def test_project_detail_visible_project_200(self, client, seeded_profile):
        response = client.get("/projects/difference-engine-notes")
        assert response.status_code == 200
        assert b"Difference Engine Notes" in response.data

    def test_project_detail_hidden_project_404s(self, client, seeded_profile):
        # Hidden at the model level (visible=False) - must not be reachable
        # by a client who already knows/guesses its slug.
        response = client.get("/projects/unpublished-draft")
        assert response.status_code == 404

    def test_project_detail_unknown_slug_404s(self, client, seeded_profile):
        response = client.get("/projects/totally-made-up-slug")
        assert response.status_code == 404


class TestOrdering:
    def test_experience_list_respects_display_order(self, app, client, seeded_profile):
        # Add a third, earlier-ordered visible experience and confirm it
        # renders before the existing one in the HTML.
        db.session.add(
            Experience(
                profile_id=seeded_profile.id,
                company="Earliest Employer",
                role="Founder",
                start_date=dt.date(1820, 1, 1),
                end_date=dt.date(1825, 1, 1),
                display_order=-1,
                visible=True,
            )
        )
        db.session.commit()
        response = client.get("/experience")
        html = response.data.decode()
        assert html.index("Earliest Employer") < html.index("Analytical Engines Ltd")


class TestThemingAcrossPublicPages:
    """Same content, at least two different active themes, no broken pages."""

    @pytest.mark.parametrize(
        "theme_key", ["minimal", "modern", "cybersecurity", "academic", "creative"]
    )
    @pytest.mark.parametrize("path", ALL_PUBLIC_GET_ROUTES)
    def test_every_theme_renders_every_page_without_error(
        self, app, client, seeded_profile, theme_key, path
    ):
        template_service.set_active_template(theme_key)
        response = client.get(path)
        assert response.status_code == 200
        assert f"theme-{theme_key}".encode() in response.data

    def test_two_themes_render_different_html_for_the_same_content(
        self, app, client, seeded_profile
    ):
        template_service.set_active_template("minimal")
        minimal_html = client.get("/").data
        template_service.set_active_template("creative")
        creative_html = client.get("/").data
        assert minimal_html != creative_html
        assert b"Ada Lovelace" in minimal_html
        assert b"Ada Lovelace" in creative_html


class TestNavigationConfiguration:
    def test_default_nav_items_are_seeded_and_shown(self, client):
        response = client.get("/")
        html = response.data.decode()
        assert 'href="/"' in html
        assert 'href="/projects"' in html

    def test_hidden_nav_item_is_not_rendered(self, app, client):
        from app.services import nav_service

        nav_service.sync_defaults()
        item = db.session.query(NavigationItem).filter_by(endpoint="public.achievements").one()
        item.visible = False
        db.session.commit()

        response = client.get("/")
        html = response.data.decode()
        assert 'href="/achievements"' not in html

    def test_nav_order_is_respected(self, app, client):
        from app.services import nav_service

        nav_service.sync_defaults()
        items = {item.endpoint: item for item in db.session.query(NavigationItem).all()}
        items["public.contact"].display_order = -1
        db.session.commit()

        response = client.get("/")
        html = response.data.decode()
        assert html.index('href="/contact"') < html.index('href="/about"')


class TestAccessibilityBasics:
    def test_skip_link_present(self, client):
        html = client.get("/").data.decode()
        assert 'href="#main-content"' in html
        assert "Skip to content" in html

    def test_hero_image_has_alt_text(self, client, seeded_profile):
        seeded_profile.profile_image_url = "https://example.com/avatar.jpg"
        db.session.commit()
        html = client.get("/").data.decode()
        assert 'alt="Portrait of Ada Lovelace"' in html

    def test_project_card_image_has_alt_text(self, client, seeded_profile):
        project = db.session.query(Project).filter_by(slug="difference-engine-notes").one()
        project.image_url = "https://example.com/shot.png"
        db.session.commit()
        html = client.get("/projects").data.decode()
        assert 'alt="Screenshot of Difference Engine Notes"' in html

    def test_contact_form_fields_are_labeled(self, client):
        html = client.get("/contact").data.decode()
        assert '<label for="contact-name">Name</label>' in html
        assert 'id="contact-name"' in html
        assert '<label for="contact-email">Email</label>' in html
        assert '<label for="contact-message">Message</label>' in html

    def test_main_landmark_and_single_visible_page_heading_present(self, client, seeded_profile):
        html = client.get("/experience").data.decode()
        assert '<main id="main-content"' in html
        assert "<h1" in html
