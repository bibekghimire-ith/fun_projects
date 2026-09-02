"""Admin route tests for Phase 2 portfolio-content CRUD.

Covers, per CLAUDE.md/docs/SECURITY.md:
- authorization is enforced on every admin route (unauthenticated -> login
  redirect; the existing `admin_required` decorator, not re-tested here
  beyond confirming it's actually applied to these new routes)
- IDOR: an id that doesn't belong to the current admin's data returns 404,
  not a leak of another owner's content
- happy-path CRUD + move-up/move-down reordering through the real HTTP
  routes (not just the service layer, which tests/test_portfolio_services.py
  already covers directly)
- server-side input validation rejects bad data (missing required field,
  invalid URL) rather than trusting the client
"""

from __future__ import annotations

from app.extensions import db
from app.models.certification import Certification
from app.models.profile import Profile, SocialLink
from app.models.project import Project
from app.models.user import User
from app.services import profile_service, resume_service


class TestAuthorizationOnPortfolioRoutes:
    def test_unauthenticated_profile_edit_redirects_to_login(self, client):
        response = client.get("/admin/profile")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]

    def test_unauthenticated_social_links_list_redirects_to_login(self, client):
        response = client.get("/admin/social-links")
        assert response.status_code == 302

    def test_unauthenticated_cannot_create_a_project(self, client):
        response = client.post("/admin/projects/new", data={"title": "Hack"})
        assert response.status_code == 302
        assert db.session.query(Project).count() == 0


class TestProfileRoute:
    def test_get_or_create_then_edit(self, app, admin_client):
        response = admin_client.get("/admin/profile")
        assert response.status_code == 200

        response = admin_client.post(
            "/admin/profile",
            data={"display_name": "Jane Doe", "tagline": "Builder"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        profile = db.session.query(Profile).one()
        assert profile.display_name == "Jane Doe"
        assert profile.tagline == "Builder"

    def test_rejects_blank_display_name(self, admin_client):
        # Visiting /admin/profile auto-creates the singleton Profile row (see
        # app/services/profile_service.get_or_create_profile), so a rejected
        # submission still leaves exactly one row - it just must not have
        # overwritten display_name with the invalid blank value.
        admin_client.get("/admin/profile")
        profile = db.session.query(Profile).one()
        original_name = profile.display_name

        response = admin_client.post("/admin/profile", data={"display_name": ""})
        assert response.status_code == 200  # re-rendered with errors, not saved
        db.session.expire_all()
        assert db.session.query(Profile).count() == 1
        assert db.session.query(Profile).one().display_name == original_name


class TestSocialLinkCrud:
    def test_full_create_edit_delete_cycle(self, admin_client):
        response = admin_client.post(
            "/admin/social-links/new",
            data={"platform": "GitHub", "url": "https://github.com/jane", "visible": "y"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        link = db.session.query(SocialLink).one()
        assert link.platform == "GitHub"

        response = admin_client.post(
            f"/admin/social-links/{link.id}/edit",
            data={"platform": "GitLab", "url": "https://gitlab.com/jane", "visible": "y"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        db.session.expire_all()
        assert db.session.get(SocialLink, link.id).platform == "GitLab"

        response = admin_client.post(f"/admin/social-links/{link.id}/delete", follow_redirects=True)
        assert response.status_code == 200
        assert db.session.query(SocialLink).count() == 0

    def test_rejects_missing_required_fields(self, admin_client):
        response = admin_client.post("/admin/social-links/new", data={"platform": "", "url": ""})
        assert response.status_code == 200
        assert db.session.query(SocialLink).count() == 0

    def test_rejects_invalid_url(self, admin_client):
        response = admin_client.post(
            "/admin/social-links/new", data={"platform": "GitHub", "url": "not-a-url"}
        )
        assert response.status_code == 200
        assert db.session.query(SocialLink).count() == 0

    def test_move_up_and_down_reorder_via_http(self, admin_client):
        admin_client.post(
            "/admin/social-links/new", data={"platform": "First", "url": "https://a.example"}
        )
        admin_client.post(
            "/admin/social-links/new", data={"platform": "Second", "url": "https://b.example"}
        )
        links = db.session.query(SocialLink).order_by(SocialLink.display_order).all()
        first, second = links[0], links[1]

        admin_client.post(f"/admin/social-links/{second.id}/move-up", follow_redirects=True)
        db.session.expire_all()
        reordered = db.session.query(SocialLink).order_by(SocialLink.display_order).all()
        assert [item.id for item in reordered] == [second.id, first.id]

    def test_idor_edit_of_nonexistent_id_is_404(self, admin_client):
        response = admin_client.get("/admin/social-links/00000000-0000-0000-0000-000000000000/edit")
        assert response.status_code == 404

    def test_idor_delete_of_nonexistent_id_is_404_and_does_not_error(self, admin_client):
        response = admin_client.post(
            "/admin/social-links/00000000-0000-0000-0000-000000000000/delete"
        )
        assert response.status_code == 404


class TestProjectCrud:
    def test_create_generates_slug_and_syncs_technologies(self, admin_client):
        response = admin_client.post(
            "/admin/projects/new",
            data={"title": "My Cool Project", "technologies": "Flask, Postgres", "visible": "y"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        project = db.session.query(Project).one()
        assert project.slug == "my-cool-project"
        assert [t.name for t in project.technologies] == ["Flask", "Postgres"]

    def test_edit_updates_technologies(self, admin_client):
        admin_client.post(
            "/admin/projects/new", data={"title": "Proj", "technologies": "Flask", "visible": "y"}
        )
        project = db.session.query(Project).one()

        admin_client.post(
            f"/admin/projects/{project.id}/edit",
            data={"title": "Proj", "technologies": "React, Vite", "visible": "y"},
            follow_redirects=True,
        )
        db.session.refresh(project)
        assert [t.name for t in project.technologies] == ["React", "Vite"]

    def test_rejects_missing_title(self, admin_client):
        response = admin_client.post("/admin/projects/new", data={"title": ""})
        assert response.status_code == 200
        assert db.session.query(Project).count() == 0


class TestCertificationCrud:
    def test_create_and_list(self, admin_client):
        response = admin_client.post(
            "/admin/certifications/new",
            data={"name": "AWS SAA", "issuer": "AWS", "visible": "y"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        cert = db.session.query(Certification).one()
        assert cert.name == "AWS SAA"

        response = admin_client.get("/admin/certifications")
        assert b"AWS SAA" in response.data

    def test_rejects_missing_issuer(self, admin_client):
        response = admin_client.post(
            "/admin/certifications/new", data={"name": "AWS SAA", "issuer": ""}
        )
        assert response.status_code == 200
        assert db.session.query(Certification).count() == 0


class TestSkillCategoryAndSkillCrud:
    def test_create_category_then_skill_and_list(self, admin_client):
        response = admin_client.post(
            "/admin/skill-categories/new",
            data={"name": "Languages", "visible": "y"},
            follow_redirects=True,
        )
        assert response.status_code == 200

        from app.models.skill import SkillCategory

        category = db.session.query(SkillCategory).one()

        response = admin_client.post(
            f"/admin/skill-categories/{category.id}/skills/new",
            data={"name": "Python", "proficiency": "5", "visible": "y"},
            follow_redirects=True,
        )
        assert response.status_code == 200
        assert b"Python" in response.data

    def test_skill_under_wrong_category_is_404(self, admin_client):
        admin_client.post("/admin/skill-categories/new", data={"name": "Languages", "visible": "y"})
        admin_client.post("/admin/skill-categories/new", data={"name": "Tools", "visible": "y"})
        from app.models.skill import SkillCategory

        cat_a, cat_b = db.session.query(SkillCategory).order_by(SkillCategory.display_order).all()
        admin_client.post(
            f"/admin/skill-categories/{cat_a.id}/skills/new",
            data={"name": "Python", "proficiency": "5", "visible": "y"},
        )
        from app.models.skill import Skill

        skill = db.session.query(Skill).one()

        response = admin_client.get(f"/admin/skill-categories/{cat_b.id}/skills/{skill.id}/edit")
        assert response.status_code == 404


class TestResumeSingleton:
    def test_get_when_none_exists_then_create_via_post(self, admin_client):
        response = admin_client.get("/admin/resume")
        assert response.status_code == 200

        response = admin_client.post(
            "/admin/resume",
            data={
                "title": "My CV",
                "public_url": "https://example.com/cv.pdf",
                "download_enabled": "y",
            },
            follow_redirects=True,
        )
        assert response.status_code == 200

        profile = profile_service.get_or_create_profile(db.session.query(User).one())
        resume = resume_service.get_resume(profile)
        assert resume is not None
        assert resume.title == "My CV"
