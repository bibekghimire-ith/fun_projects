"""Profile CRUD.

There is exactly one administrator account in this application (Phase 1),
so `get_or_create_profile` transparently creates the single `Profile` row
the first time an admin visits the profile editor, rather than requiring a
separate "create profile" step.
"""

from __future__ import annotations

from typing import Any

from app.extensions import db
from app.models.profile import Profile
from app.models.user import User


def get_or_create_profile(user: User) -> Profile:
    profile = db.session.query(Profile).filter_by(user_id=user.id).first()
    if profile is None:
        profile = Profile(user_id=user.id, display_name=user.email.split("@")[0])
        db.session.add(profile)
        db.session.commit()
    return profile


def update_profile(profile: Profile, fields: dict[str, Any]) -> Profile:
    for key, value in fields.items():
        setattr(profile, key, value)
    db.session.commit()
    return profile


def get_public_profile() -> Profile | None:
    """The profile the public site renders.

    This application seeds exactly one administrator (Phase 1), so exactly
    one `Profile` exists in practice; the public site is single-tenant and
    simply renders whichever profile exists first (deterministic by
    creation order), returning None (a "not configured yet" empty state,
    handled by every public template) rather than raising if none exists
    yet - e.g. right after a fresh install before the admin has visited
    `/admin/profile` for the first time.
    """

    return db.session.query(Profile).order_by(Profile.created_at).first()
