"""CSRF enforcement for the public contact form (Phase 7).

Same pattern as tests/test_csrf.py's login coverage: the default test
`app`/`client` fixtures disable WTF_CSRF_ENABLED, so this module builds its
own CSRF-enabled app to prove ContactForm (a FlaskForm) actually rejects a
token-less POST.
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


def test_contact_post_without_csrf_token_is_rejected(csrf_client):
    response = csrf_client.post(
        "/contact",
        data={
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "subject": "Hello",
            "message": "Hi there.",
            "website": "",
        },
    )
    assert response.status_code == 400


def test_contact_post_with_valid_csrf_token_is_accepted(csrf_client):
    get_response = csrf_client.get("/contact")
    assert get_response.status_code == 200
    html = get_response.get_data(as_text=True)

    marker = 'name="csrf_token" type="hidden" value="'
    start = html.index(marker) + len(marker)
    end = html.index('"', start)
    token = html[start:end]

    response = csrf_client.post(
        "/contact",
        data={
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "subject": "Hello",
            "message": "Hi there.",
            "website": "",
            "csrf_token": token,
        },
    )
    assert response.status_code == 200
    assert b"Thanks" in response.data
