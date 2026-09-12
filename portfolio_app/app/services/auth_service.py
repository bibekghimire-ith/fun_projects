"""Authentication business logic.

Routes (app/auth/routes.py) call into this module rather than talking to
the ORM or a hashing library directly, per CLAUDE.md's "keep business logic
out of templates and route functions" rule.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerifyMismatchError
from flask import Flask

from app.extensions import db
from app.models.base import utcnow
from app.models.user import User, UserRole

# Argon2id (argon2-cffi's default `Type.ID`) per docs/SECURITY.md's
# "strong password hashing (Argon2id preferred; bcrypt acceptable)". See
# docs/DECISIONS.md for why Argon2id was chosen over werkzeug's built-in
# pbkdf2/scrypt helpers.
_hasher = PasswordHasher()


def hash_password(plaintext: str) -> str:
    """Hash a plaintext password with Argon2id."""

    return _hasher.hash(plaintext)


def verify_password(password_hash: str, plaintext: str) -> bool:
    """Constant-time-ish verification of a plaintext password against a hash.

    Returns False (rather than raising) on any mismatch or malformed hash so
    callers never need to catch argon2 exceptions themselves.
    """

    try:
        return _hasher.verify(password_hash, plaintext)
    except (VerifyMismatchError, InvalidHash):
        return False
    except Exception:  # noqa: BLE001 - never let a malformed hash 500 the request
        return False


def normalize_email(email: str) -> str:
    return email.strip().lower()


def authenticate(email: str, plaintext_password: str) -> User | None:
    """Return the matching active User, or None on any failure.

    Deliberately returns the same generic failure for "no such user",
    "wrong password", and "inactive account" so the login endpoint cannot be
    used to enumerate valid admin emails.
    """

    if not email or not plaintext_password:
        return None

    normalized = normalize_email(email)
    user = db.session.query(User).filter_by(email=normalized).first()

    if user is None:
        # Run a hash verification anyway against a fixed dummy hash so the
        # response time for "unknown email" is close to "wrong password",
        # reducing (not eliminating) email-enumeration-by-timing risk.
        verify_password(
            "$argon2id$v=19$m=65536,t=3,p=4$"
            "c2FsdHNhbHRzYWx0c2FsdA$"
            "3Vy8dQqVv1KJ1lYQxJq1YkP0X0dQ3n8m0m5oGmQxJq0",
            plaintext_password,
        )
        return None

    if not user.is_active or not verify_password(user.password_hash, plaintext_password):
        return None

    return user


def record_successful_login(user: User) -> None:
    user.last_login_at = utcnow()
    db.session.add(user)
    db.session.commit()


def bootstrap_admin(app: Flask) -> tuple[bool, str]:
    """Idempotently create the single administrator account from env vars.

    Safe to run on every deployment/startup:
    - does nothing if ADMIN_BOOTSTRAP_EMAIL is unset
    - does nothing if neither ADMIN_BOOTSTRAP_PASSWORD_HASH nor
      ADMIN_BOOTSTRAP_PASSWORD is set
    - never overwrites an existing account (per CLAUDE.md: "Do not silently
      delete or overwrite user content") - an operator who wants to rotate
      the admin password uses a future admin UI / dedicated CLI command,
      not this bootstrap path.

    Returns (created, message) for the calling CLI command to display.
    """

    email = normalize_email(app.config.get("ADMIN_BOOTSTRAP_EMAIL") or "")
    if not email:
        return False, "ADMIN_BOOTSTRAP_EMAIL is not set; skipping admin bootstrap."

    password_hash = app.config.get("ADMIN_BOOTSTRAP_PASSWORD_HASH") or ""
    plaintext = app.config.get("ADMIN_BOOTSTRAP_PASSWORD") or ""

    if not password_hash and not plaintext:
        return (
            False,
            "Neither ADMIN_BOOTSTRAP_PASSWORD_HASH nor ADMIN_BOOTSTRAP_PASSWORD is set; "
            "skipping admin bootstrap.",
        )

    if not password_hash:
        password_hash = hash_password(plaintext)

    existing = db.session.query(User).filter_by(email=email).first()
    if existing is not None:
        return False, f"Administrator account {email} already exists; no changes made."

    user = User(
        email=email,
        password_hash=password_hash,
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()
    return True, f"Created administrator account: {email}"
