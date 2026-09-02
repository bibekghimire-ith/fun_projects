"""Admin route tests for Phase 3 template selection/preview.

Same conventions as tests/test_admin_portfolio_routes.py: authorization is
verified through real HTTP requests (unauthenticated -> redirect to login),
CSRF is exercised implicitly (TestingConfig disables it, matching every
other admin-route test in this suite; tests/test_csrf.py covers the
CSRF-enabled path generically), and an invalid/unknown template key is
treated like any other bad object reference in this app (404, not a 500 or
a silent no-op).
"""

from __future__ import annotations

from app.models.portfolio_template import PortfolioTemplate


class TestAuthorizationOnTemplateRoutes:
    def test_unauthenticated_templates_list_redirects_to_login(self, client):
        response = client.get("/admin/templates")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]

    def test_unauthenticated_preview_redirects_to_login(self, client):
        response = client.get("/admin/templates/minimal/preview")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]

    def test_unauthenticated_activate_redirects_to_login_and_changes_nothing(self, client, app):
        from app.services import template_service

        template_service.set_active_template("minimal")
        response = client.post("/admin/templates/modern/activate")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]
        assert template_service.get_active_template().key == "minimal"


class TestTemplatesList:
    def test_lists_all_five_built_in_templates(self, admin_client):
        response = admin_client.get("/admin/templates")
        assert response.status_code == 200
        for name in [
            "Minimal Developer",
            "Modern Professional",
            "Cybersecurity",
            "Academic",
            "Creative",
        ]:
            assert name.encode() in response.data


class TestActivateTemplate:
    def test_activating_a_valid_template_switches_it(self, admin_client, app):
        from app.services import template_service

        response = admin_client.post("/admin/templates/cybersecurity/activate")
        assert response.status_code == 302
        assert template_service.get_active_template().key == "cybersecurity"

    def test_unknown_template_key_is_404_and_changes_nothing(self, admin_client, app):
        from app.services import template_service

        template_service.set_active_template("minimal")
        response = admin_client.post("/admin/templates/not-a-real-theme/activate")
        assert response.status_code == 404
        assert template_service.get_active_template().key == "minimal"

    def test_activation_does_not_create_or_delete_template_rows(self, admin_client, app):
        from app.extensions import db

        admin_client.post("/admin/templates/academic/activate")
        assert db.session.query(PortfolioTemplate).count() == 5


class TestPreviewTemplate:
    def test_preview_renders_signed_in_admins_own_profile(self, admin_client):
        admin_client.post(
            "/admin/profile",
            data={"display_name": "Grace Hopper", "tagline": "Compiler pioneer"},
        )
        response = admin_client.get("/admin/templates/modern/preview")
        assert response.status_code == 200
        assert b"Grace Hopper" in response.data
        assert b"theme-modern" in response.data

    def test_preview_of_unknown_theme_is_404(self, admin_client):
        response = admin_client.get("/admin/templates/not-a-real-theme/preview")
        assert response.status_code == 404

    def test_preview_of_each_theme_renders_distinct_html_for_same_profile(self, admin_client):
        admin_client.post(
            "/admin/profile",
            data={"display_name": "Margaret Hamilton", "tagline": "Software engineering pioneer"},
        )
        pages = {}
        for key in ["minimal", "modern", "cybersecurity", "academic", "creative"]:
            response = admin_client.get(f"/admin/templates/{key}/preview")
            assert response.status_code == 200
            assert b"Margaret Hamilton" in response.data
            pages[key] = response.data

        # Every theme's rendered HTML is unique - not five copies of one page.
        assert len(set(pages.values())) == len(pages)
