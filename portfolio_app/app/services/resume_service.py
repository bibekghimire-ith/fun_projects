"""Resume upsert, scoped to a Profile (a 1:1 singleton, not a list)."""

from __future__ import annotations

from typing import Any

from app.extensions import db
from app.models.profile import Profile
from app.models.resume import Resume


def get_resume(profile: Profile) -> Resume | None:
    return db.session.query(Resume).filter_by(profile_id=profile.id).first()


def upsert_resume(profile: Profile, fields: dict[str, Any]) -> Resume:
    resume = get_resume(profile)
    if resume is None:
        resume = Resume(profile_id=profile.id, **fields)
        db.session.add(resume)
    else:
        for key, value in fields.items():
            setattr(resume, key, value)
    db.session.commit()
    return resume
