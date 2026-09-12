"""Shared pytest fixtures.

Tests run against the "testing" config, which defaults to an in-memory
SQLite database so the suite has no external service dependencies (per
CLAUDE.md rule: "Make automated tests deterministic and independent of
external services").
"""

from __future__ import annotations

import pytest

from app import create_app
from app.extensions import db as _db
from app.extensions import limiter as _limiter


@pytest.fixture()
def app():
    application = create_app("testing")

    with application.app_context():
        _db.create_all()
        # The rate limiter's in-memory storage is process-wide (tied to the
        # module-level `limiter` extension instance, not per-Flask-app), so
        # without a reset here, counts from one test's requests would leak
        # into the next test and make login-rate-limit assertions flaky.
        _limiter.reset()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_client(client, admin_user):
    """A test client already logged in as `admin_user`."""

    response = client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": admin_user["password"]},
    )
    assert response.status_code == 302
    return client


@pytest.fixture()
def admin_user(app):
    """A persisted active admin user with a known plaintext password."""

    from app.models.user import User, UserRole
    from app.services import auth_service

    password = "CorrectHorseBatteryStaple1!"
    user = User(
        email="admin@example.com",
        password_hash=auth_service.hash_password(password),
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    _db.session.add(user)
    _db.session.commit()
    return {"user": user, "password": password}
