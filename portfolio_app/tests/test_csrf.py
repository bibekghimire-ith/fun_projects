"""CSRF enforcement tests.

tests/conftest.py's default `app` fixture disables WTF_CSRF_ENABLED (per
docs/DECISIONS.md #6, to keep most test clients simple). This module
explicitly re-enables it for a focused check that the login form actually
rejects a request with a missing/invalid CSRF token, proving CSRFProtect is
wired correctly rather than merely present in extensions.py.
"""

from __future__ import annotations

import pytest

from app import create_app
from app.config import TestingConfig
from app.extensions import db as _db
from app.extensions import limiter as _limiter


class CsrfEnabledConfig(TestingConfig):
    WTF_CSRF_ENABLED = True


@pytest.fixture()
def csrf_client():
    application = create_app(CsrfEnabledConfig)
    with application.app_context():
        _db.create_all()
        _limiter.reset()
        with application.test_client() as client:
            yield client
        _db.session.remove()
        _db.drop_all()


def test_login_post_without_csrf_token_is_rejected(csrf_client):
    response = csrf_client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": "whatever"},
    )
    assert response.status_code == 400


def test_login_post_with_valid_csrf_token_is_accepted(csrf_client):
    get_response = csrf_client.get("/auth/login")
    assert get_response.status_code == 200
    html = get_response.get_data(as_text=True)

    # Pull the token out of the rendered hidden input.
    marker = 'name="csrf_token" type="hidden" value="'
    start = html.index(marker) + len(marker)
    end = html.index('"', start)
    token = html[start:end]

    response = csrf_client.post(
        "/auth/login",
        data={
            "email": "admin@example.com",
            "password": "wrong-but-well-formed",
            "csrf_token": token,
        },
    )
    # Not a CSRF rejection (400) - it proceeds to the normal
    # invalid-credentials path (200, re-rendered form).
    assert response.status_code == 200
    assert b"Invalid email or password" in response.data
