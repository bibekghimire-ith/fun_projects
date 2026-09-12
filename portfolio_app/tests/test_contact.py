"""Public contact form tests (Phase 7).

Covers server-side validation, persistence, the honeypot spam guard, and
graceful no-op behavior when no notification recipient is configured -
CLAUDE.md's Contact section requirements, minus CSRF/rate-limiting which
have their own dedicated test modules (tests/test_contact_csrf.py,
tests/test_contact_rate_limit.py) following the same split
tests/test_csrf.py and tests/test_rate_limit.py already established for
login.
"""

from __future__ import annotations

from app.models.contact_message import ContactMessage, ContactMessageStatus


def _valid_payload(**overrides):
    payload = {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "subject": "Hello",
        "message": "I'd like to get in touch about a project.",
        "website": "",  # honeypot, must stay empty
    }
    payload.update(overrides)
    return payload


def test_contact_page_renders_form(client):
    response = client.get("/contact")
    assert response.status_code == 200
    assert b"contact-message" in response.data


def test_valid_submission_is_persisted(app, client):
    response = client.post("/contact", data=_valid_payload(), follow_redirects=False)
    assert response.status_code == 200

    from app.extensions import db

    with app.app_context():
        rows = db.session.query(ContactMessage).all()
        assert len(rows) == 1
        assert rows[0].name == "Ada Lovelace"
        assert rows[0].email == "ada@example.com"
        assert rows[0].subject == "Hello"
        assert rows[0].status == ContactMessageStatus.NEW
        assert rows[0].ip_address is not None


def test_missing_required_fields_are_rejected(app, client):
    response = client.post(
        "/contact", data=_valid_payload(name="", message=""), follow_redirects=False
    )
    assert response.status_code == 200

    from app.extensions import db

    with app.app_context():
        assert db.session.query(ContactMessage).count() == 0


def test_invalid_email_is_rejected(app, client):
    response = client.post("/contact", data=_valid_payload(email="not-an-email"))
    assert response.status_code == 200

    from app.extensions import db

    with app.app_context():
        assert db.session.query(ContactMessage).count() == 0


def test_oversized_message_is_rejected(app, client):
    response = client.post("/contact", data=_valid_payload(message="x" * 6000))
    assert response.status_code == 200

    from app.extensions import db

    with app.app_context():
        assert db.session.query(ContactMessage).count() == 0


def test_honeypot_filled_silently_drops_submission(app, client):
    response = client.post("/contact", data=_valid_payload(website="http://spam.example"))
    # Looks like success to the caller (no distinguishing signal for a bot).
    assert response.status_code == 200

    from app.extensions import db

    with app.app_context():
        assert db.session.query(ContactMessage).count() == 0


def test_notification_is_skipped_gracefully_when_unconfigured(app, client):
    app.config["CONTACT_NOTIFY_EMAIL"] = ""
    response = client.post("/contact", data=_valid_payload())
    assert response.status_code == 200

    from app.extensions import db

    with app.app_context():
        # The message is still persisted even though no notification was sent.
        assert db.session.query(ContactMessage).count() == 1


def test_no_smtp_credentials_or_admin_email_leak_when_unconfigured(app, client):
    app.config["MAIL_SMTP_PASSWORD"] = "super-secret-password"
    app.config["MAIL_PROVIDER"] = "console"
    response = client.post("/contact", data=_valid_payload())
    assert b"super-secret-password" not in response.data
