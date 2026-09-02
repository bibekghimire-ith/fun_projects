"""Model-level constraint and relationship tests for Phase 2 portfolio content.

Uses the in-memory SQLite `app`/`client` fixtures from tests/conftest.py, per
CLAUDE.md's "make automated tests deterministic and independent of external
services" - SQLite enforces foreign keys and CHECK constraints the same way
these tests assert against (verified separately against real PostgreSQL in
this phase's manual verification pass; see docs/IMPLEMENTATION_STATE.md).
"""

from __future__ import annotations

import datetime as dt

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.certification import Certification
from app.models.education import Education
from app.models.experience import Experience
from app.models.profile import Profile, SocialLink
from app.models.project import Project, ProjectTechnology
from app.models.resume import Resume
from app.models.skill import Skill, SkillCategory
from app.models.user import User, UserRole


def _make_user(email: str = "owner@example.com") -> User:
    user = User(email=email, password_hash="x", role=UserRole.ADMIN.value, is_active=True)
    db.session.add(user)
    db.session.commit()
    return user


def _make_profile(user: User | None = None) -> Profile:
    user = user or _make_user()
    profile = Profile(user_id=user.id, display_name="Jane Doe")
    db.session.add(profile)
    db.session.commit()
    return profile


class TestProfile:
    def test_create_and_defaults(self, app):
        with app.app_context():
            profile = _make_profile()
            assert profile.id is not None
            assert profile.created_at is not None
            assert profile.updated_at is not None

    def test_user_id_is_unique(self, app):
        with app.app_context():
            user = _make_user()
            _make_profile(user)
            duplicate = Profile(user_id=user.id, display_name="Duplicate")
            db.session.add(duplicate)
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()

    def test_deleting_profile_cascades_to_children(self, app):
        with app.app_context():
            profile = _make_profile()
            db.session.add(SocialLink(profile_id=profile.id, platform="GitHub", url="https://x"))
            db.session.add(
                Experience(
                    profile_id=profile.id,
                    company="Acme",
                    role="Engineer",
                    start_date=dt.date(2020, 1, 1),
                )
            )
            db.session.commit()
            assert db.session.query(SocialLink).count() == 1
            assert db.session.query(Experience).count() == 1

            db.session.delete(profile)
            db.session.commit()

            assert db.session.query(SocialLink).count() == 0
            assert db.session.query(Experience).count() == 0


class TestSocialLink:
    def test_defaults(self, app):
        with app.app_context():
            profile = _make_profile()
            link = SocialLink(profile_id=profile.id, platform="GitHub", url="https://github.com/x")
            db.session.add(link)
            db.session.commit()
            assert link.display_order == 0
            assert link.visible is True

    def test_requires_profile_id(self, app):
        with app.app_context():
            link = SocialLink(platform="GitHub", url="https://github.com/x")
            db.session.add(link)
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()


class TestExperience:
    def test_requires_start_date(self, app):
        with app.app_context():
            profile = _make_profile()
            exp = Experience(profile_id=profile.id, company="Acme", role="Engineer")
            db.session.add(exp)
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()


class TestSkill:
    def test_proficiency_out_of_range_is_rejected(self, app):
        with app.app_context():
            category = SkillCategory(name="Languages")
            db.session.add(category)
            db.session.commit()

            skill = Skill(category_id=category.id, name="Python", proficiency=6)
            db.session.add(skill)
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()

    def test_proficiency_in_range_is_accepted(self, app):
        with app.app_context():
            category = SkillCategory(name="Languages")
            db.session.add(category)
            db.session.commit()

            skill = Skill(category_id=category.id, name="Python", proficiency=5)
            db.session.add(skill)
            db.session.commit()
            assert skill.id is not None

    def test_deleting_category_cascades_to_skills(self, app):
        with app.app_context():
            category = SkillCategory(name="Languages")
            db.session.add(category)
            db.session.commit()
            db.session.add(Skill(category_id=category.id, name="Python", proficiency=3))
            db.session.commit()
            assert db.session.query(Skill).count() == 1

            db.session.delete(category)
            db.session.commit()
            assert db.session.query(Skill).count() == 0

    def test_category_name_is_unique(self, app):
        with app.app_context():
            db.session.add(SkillCategory(name="Languages"))
            db.session.commit()
            db.session.add(SkillCategory(name="Languages"))
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()


class TestProject:
    def test_slug_is_unique(self, app):
        with app.app_context():
            profile = _make_profile()
            db.session.add(Project(profile_id=profile.id, title="One", slug="my-slug"))
            db.session.commit()
            db.session.add(Project(profile_id=profile.id, title="Two", slug="my-slug"))
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()

    def test_deleting_project_cascades_to_technologies(self, app):
        with app.app_context():
            profile = _make_profile()
            project = Project(profile_id=profile.id, title="One", slug="one")
            db.session.add(project)
            db.session.commit()
            db.session.add(ProjectTechnology(project_id=project.id, name="Flask"))
            db.session.commit()
            assert db.session.query(ProjectTechnology).count() == 1

            db.session.delete(project)
            db.session.commit()
            assert db.session.query(ProjectTechnology).count() == 0


class TestResume:
    def test_profile_id_is_unique(self, app):
        with app.app_context():
            profile = _make_profile()
            db.session.add(Resume(profile_id=profile.id, title="CV"))
            db.session.commit()
            db.session.add(Resume(profile_id=profile.id, title="CV 2"))
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()


class TestEducationCertification:
    def test_certification_requires_issuer(self, app):
        with app.app_context():
            profile = _make_profile()
            cert = Certification(profile_id=profile.id, name="AWS SAA")
            db.session.add(cert)
            with pytest.raises(IntegrityError):
                db.session.commit()
            db.session.rollback()

    def test_education_defaults_are_visible_and_ordered(self, app):
        with app.app_context():
            profile = _make_profile()
            edu = Education(profile_id=profile.id, institution="MIT")
            db.session.add(edu)
            db.session.commit()
            assert edu.display_order == 0
            assert edu.visible is True
