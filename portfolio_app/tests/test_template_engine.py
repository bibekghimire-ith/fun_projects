"""Phase 3 template engine: registry, active-template service, rendering.

Covers this phase's exit criterion directly: "switching templates changes
presentation without changing content" - `TestSwitchingNeverMutatesContent`
below renders the same Profile/Experience content under two different
active templates and asserts the underlying DB rows are byte-identical
while the rendered HTML differs.
"""

from __future__ import annotations

import datetime as dt

import pytest

from app.extensions import db
from app.models.experience import Experience
from app.models.portfolio_template import PortfolioTemplate
from app.models.profile import Profile
from app.services import template_service
from app.services.template_service import UnknownTemplateError
from app.templates_engine import registry


@pytest.fixture()
def profile_with_experience(app):
    from app.models.user import User, UserRole
    from app.services import auth_service

    user = User(
        email="theme-admin@example.com",
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
    )
    db.session.add(profile)
    db.session.commit()

    experience = Experience(
        profile_id=profile.id,
        company="Analytical Engines Ltd",
        role="Lead Programmer",
        start_date=dt.date(1840, 1, 1),
        is_current=True,
        display_order=0,
    )
    db.session.add(experience)
    db.session.commit()

    return profile


class TestRegistry:
    def test_all_five_required_themes_are_registered(self):
        keys = set(registry.theme_keys())
        assert keys == {"minimal", "modern", "cybersecurity", "academic", "creative"}

    def test_get_theme_returns_none_for_unknown_key(self):
        assert registry.get_theme("does-not-exist") is None

    def test_is_valid_theme(self):
        assert registry.is_valid_theme("minimal") is True
        assert registry.is_valid_theme("bogus") is False


class TestSyncAndActiveTemplate:
    def test_sync_creates_one_row_per_registered_theme(self, app):
        template_service.sync_registry()
        rows = db.session.query(PortfolioTemplate).all()
        assert {row.key for row in rows} == set(registry.theme_keys())

    def test_sync_is_idempotent(self, app):
        template_service.sync_registry()
        first_count = db.session.query(PortfolioTemplate).count()
        template_service.sync_registry()
        second_count = db.session.query(PortfolioTemplate).count()
        assert first_count == second_count == len(registry.theme_keys())

    def test_a_default_template_is_active_after_first_sync(self, app):
        active = template_service.get_active_template()
        assert active.key == registry.DEFAULT_THEME_KEY
        assert active.is_active is True

    def test_exactly_one_row_is_active_at_a_time(self, app):
        template_service.sync_registry()
        active_count = db.session.query(PortfolioTemplate).filter_by(is_active=True).count()
        assert active_count == 1


class TestSetActiveTemplate:
    def test_only_registered_theme_keys_are_selectable(self, app):
        with pytest.raises(UnknownTemplateError):
            template_service.set_active_template("not-a-real-theme")

    def test_rejecting_an_invalid_key_does_not_change_the_active_template(self, app):
        template_service.set_active_template("modern")
        with pytest.raises(UnknownTemplateError):
            template_service.set_active_template("not-a-real-theme")
        assert template_service.get_active_template().key == "modern"

    def test_activating_a_template_deactivates_every_other_one(self, app):
        template_service.set_active_template("modern")
        template_service.set_active_template("academic")

        rows = db.session.query(PortfolioTemplate).all()
        active_keys = [row.key for row in rows if row.is_active]
        assert active_keys == ["academic"]

    @pytest.mark.parametrize("key", ["minimal", "modern", "cybersecurity", "academic", "creative"])
    def test_can_activate_every_registered_theme(self, app, key):
        activated = template_service.set_active_template(key)
        assert activated.key == key
        assert template_service.get_active_template().key == key


class TestRenderPreview:
    @pytest.mark.parametrize("key", ["minimal", "modern", "cybersecurity", "academic", "creative"])
    def test_each_theme_renders_without_error(self, app, profile_with_experience, key):
        with app.test_request_context():
            html = template_service.render_preview(
                key,
                profile=profile_with_experience,
                experiences=profile_with_experience.experiences,
            )
        assert "<html" in html
        assert profile_with_experience.display_name in html
        assert f"theme-{key}" in html

    def test_unknown_theme_key_raises(self, app, profile_with_experience):
        with app.test_request_context(), pytest.raises(UnknownTemplateError):
            template_service.render_preview(
                "not-a-real-theme",
                profile=profile_with_experience,
                experiences=[],
            )


class TestSwitchingNeverMutatesContent:
    """The Phase 3 exit criterion, verified directly."""

    def test_switching_active_template_does_not_touch_content_rows(
        self, app, profile_with_experience
    ):
        profile_id = profile_with_experience.id
        before_profile = db.session.get(Profile, profile_id)
        before_snapshot = (
            before_profile.display_name,
            before_profile.professional_title,
            before_profile.tagline,
            before_profile.updated_at,
        )
        experience = before_profile.experiences[0]
        before_experience_snapshot = (
            experience.company,
            experience.role,
            experience.start_date,
            experience.display_order,
        )

        template_service.set_active_template("modern")
        template_service.set_active_template("cybersecurity")
        template_service.set_active_template("academic")

        after_profile = db.session.get(Profile, profile_id)
        after_snapshot = (
            after_profile.display_name,
            after_profile.professional_title,
            after_profile.tagline,
            after_profile.updated_at,
        )
        after_experience = after_profile.experiences[0]
        after_experience_snapshot = (
            after_experience.company,
            after_experience.role,
            after_experience.start_date,
            after_experience.display_order,
        )

        assert after_snapshot == before_snapshot
        assert after_experience_snapshot == before_experience_snapshot
        # Nothing was added/removed either - still exactly one profile, one
        # experience row.
        assert db.session.query(Profile).count() == 1
        assert db.session.query(Experience).count() == 1

    def test_same_content_renders_different_html_under_different_templates(
        self, app, profile_with_experience
    ):
        with app.test_request_context():
            html_minimal = template_service.render_preview(
                "minimal",
                profile=profile_with_experience,
                experiences=profile_with_experience.experiences,
            )
            html_creative = template_service.render_preview(
                "creative",
                profile=profile_with_experience,
                experiences=profile_with_experience.experiences,
            )

        assert html_minimal != html_creative
        # Same underlying content appears in both...
        assert profile_with_experience.display_name in html_minimal
        assert profile_with_experience.display_name in html_creative
        assert "Analytical Engines Ltd" in html_minimal
        assert "Analytical Engines Ltd" in html_creative
        # ...rendered through genuinely different presentation markup.
        assert "theme-minimal" in html_minimal
        assert "theme-minimal" not in html_creative
        assert "theme-creative" in html_creative
        assert "theme-creative" not in html_minimal
