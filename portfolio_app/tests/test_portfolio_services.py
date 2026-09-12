"""Service-layer CRUD + reordering tests for Phase 2 portfolio content.

Exercises app/services/portfolio_content.py's generic engine (used by every
profile-scoped entity) plus the entity-specific behavior in
app/services/project_service.py (slugging) and app/services/skill_service.py
(category-scoped skills).
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest

from app.extensions import db
from app.models.experience import Experience
from app.models.profile import Profile, SocialLink
from app.models.user import User, UserRole
from app.services import (
    experience_service,
    profile_service,
    project_service,
    resume_service,
    skill_service,
    social_link_service,
)
from app.services import (
    portfolio_content as pc,
)


@pytest.fixture()
def profile(app):
    user = User(
        email="owner@example.com", password_hash="x", role=UserRole.ADMIN.value, is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return profile_service.get_or_create_profile(user)


class TestProfileService:
    def test_get_or_create_is_idempotent(self, app):
        user = User(
            email="a@example.com", password_hash="x", role=UserRole.ADMIN.value, is_active=True
        )
        db.session.add(user)
        db.session.commit()

        first = profile_service.get_or_create_profile(user)
        second = profile_service.get_or_create_profile(user)
        assert first.id == second.id
        assert db.session.query(Profile).count() == 1

    def test_update_profile(self, app, profile):
        profile_service.update_profile(profile, {"display_name": "New Name", "tagline": "Hi"})
        db.session.expire_all()
        refreshed = db.session.get(Profile, profile.id)
        assert refreshed.display_name == "New Name"
        assert refreshed.tagline == "Hi"


class TestSocialLinkService:
    def test_create_list_update_delete(self, app, profile):
        link = social_link_service.create_social_link(
            profile, {"platform": "GitHub", "url": "https://github.com/x", "visible": True}
        )
        assert link.display_order == 0
        assert social_link_service.list_social_links(profile) == [link]

        social_link_service.update_social_link(link, {"platform": "GitLab"})
        assert db.session.get(SocialLink, link.id).platform == "GitLab"

        social_link_service.delete_social_link(link)
        assert social_link_service.list_social_links(profile) == []

    def test_new_entries_append_to_end_of_order(self, app, profile):
        first = social_link_service.create_social_link(
            profile, {"platform": "A", "url": "https://a"}
        )
        second = social_link_service.create_social_link(
            profile, {"platform": "B", "url": "https://b"}
        )
        assert first.display_order == 0
        assert second.display_order == 1

    def test_get_social_link_is_scoped_to_owning_profile(self, app, profile):
        other_user = User(
            email="other@example.com", password_hash="x", role=UserRole.ADMIN.value, is_active=True
        )
        db.session.add(other_user)
        db.session.commit()
        other_profile = profile_service.get_or_create_profile(other_user)

        link = social_link_service.create_social_link(
            profile, {"platform": "A", "url": "https://a"}
        )

        # The IDOR guard: fetching by id under the wrong profile returns None.
        assert social_link_service.get_social_link(other_profile, link.id) is None
        assert social_link_service.get_social_link(profile, link.id) is link


class TestReordering:
    def test_move_up_and_down_swap_neighbors(self, app, profile):
        a = experience_service.create_experience(
            profile, {"company": "A", "role": "Eng", "start_date": date(2020, 1, 1)}
        )
        b = experience_service.create_experience(
            profile, {"company": "B", "role": "Eng", "start_date": date(2021, 1, 1)}
        )
        c = experience_service.create_experience(
            profile, {"company": "C", "role": "Eng", "start_date": date(2022, 1, 1)}
        )
        assert [e.company for e in experience_service.list_experiences(profile)] == ["A", "B", "C"]

        experience_service.move_experience(profile, b, "up")
        assert [e.company for e in experience_service.list_experiences(profile)] == ["B", "A", "C"]

        experience_service.move_experience(profile, a, "down")
        assert [e.company for e in experience_service.list_experiences(profile)] == ["B", "C", "A"]

        # No-op at the boundary.
        experience_service.move_experience(profile, b, "up")
        assert [e.company for e in experience_service.list_experiences(profile)] == ["B", "C", "A"]

        db.session.delete(a)
        db.session.delete(b)
        db.session.delete(c)
        db.session.commit()

    def test_reorder_scoped_applies_explicit_order(self, app, profile):
        a = experience_service.create_experience(
            profile, {"company": "A", "role": "Eng", "start_date": date(2020, 1, 1)}
        )
        b = experience_service.create_experience(
            profile, {"company": "B", "role": "Eng", "start_date": date(2021, 1, 1)}
        )
        pc.reorder_scoped(Experience, [b.id, a.id], profile_id=profile.id)
        assert [e.company for e in experience_service.list_experiences(profile)] == ["B", "A"]

    def test_reorder_scoped_rejects_mismatched_id_set(self, app, profile):
        a = experience_service.create_experience(
            profile, {"company": "A", "role": "Eng", "start_date": date(2020, 1, 1)}
        )
        with pytest.raises(ValueError):
            pc.reorder_scoped(Experience, [a.id, uuid.uuid4()], profile_id=profile.id)


class TestProjectService:
    def test_slug_is_generated_from_title(self, app, profile):
        project = project_service.create_project(profile, {"title": "My Cool Project!"}, [])
        assert project.slug == "my-cool-project"

    def test_duplicate_slug_is_disambiguated(self, app, profile):
        first = project_service.create_project(profile, {"title": "Same Title"}, [])
        second = project_service.create_project(profile, {"title": "Same Title"}, [])
        assert first.slug == "same-title"
        assert second.slug == "same-title-2"

    def test_updating_a_project_keeps_its_own_slug(self, app, profile):
        project = project_service.create_project(profile, {"title": "Original"}, [])
        updated = project_service.update_project(project, {"title": "Original"}, [])
        assert updated.slug == "original"

    def test_technologies_are_synced_in_order(self, app, profile):
        project = project_service.create_project(
            profile, {"title": "Tech Project"}, ["Flask", "Postgres", "HTMX"]
        )
        assert [t.name for t in project.technologies] == ["Flask", "Postgres", "HTMX"]

        project_service.update_project(project, {"title": "Tech Project"}, ["React"])
        db.session.refresh(project)
        assert [t.name for t in project.technologies] == ["React"]


class TestSkillService:
    def test_skills_are_scoped_to_their_category(self, app):
        cat_a = skill_service.create_skill_category({"name": "Languages"})
        cat_b = skill_service.create_skill_category({"name": "Tools"})
        skill = skill_service.create_skill(cat_a, {"name": "Python", "proficiency": 5})

        assert skill_service.get_skill(cat_a, skill.id) is skill
        # The IDOR guard: a skill fetched under the wrong category is "not found".
        assert skill_service.get_skill(cat_b, skill.id) is None


class TestResumeService:
    def test_upsert_creates_then_updates(self, app, profile):
        assert resume_service.get_resume(profile) is None

        created = resume_service.upsert_resume(profile, {"title": "CV"})
        assert created.title == "CV"

        updated = resume_service.upsert_resume(profile, {"title": "CV v2"})
        assert updated.id == created.id
        assert updated.title == "CV v2"
