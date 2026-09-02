"""Server-side authorization tests.

Verifies Phase 1's exit criterion: "unauthenticated users cannot access
admin routes" - and that authorization is re-checked from server-side
state (the DB-backed `is_active`/`role` columns), never trusting anything
client-supplied.
"""

from __future__ import annotations

from app.extensions import db
from app.models.user import User


def test_unauthenticated_request_to_admin_root_is_redirected_to_login(client):
    response = client.get("/admin/")
    assert response.status_code == 302
    assert "/auth/login" in response.headers["Location"]
    assert "next=%2Fadmin%2F" in response.headers["Location"]


def test_unauthenticated_admin_access_does_not_leak_dashboard_content(client):
    response = client.get("/admin/", follow_redirects=True)
    assert b"Signed in as" not in response.data


def test_authenticated_admin_can_access_dashboard(client, admin_user):
    client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": admin_user["password"]},
    )
    response = client.get("/admin/")
    assert response.status_code == 200


def test_deactivating_a_user_revokes_admin_access_on_next_request(app, client, admin_user):
    client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": admin_user["password"]},
    )
    assert client.get("/admin/").status_code == 200

    # Test client requests reuse the ambient app context pushed by the
    # `app` fixture (Flask only pushes a fresh one if none is active), so
    # mutating through the same `db.session` - rather than a separate
    # nested app_context() - is what actually models "the server-side
    # record changed before the next request".
    user = db.session.get(User, admin_user["user"].id)
    user.is_active = False
    db.session.commit()

    # Same session cookie, but the server-side record now says inactive:
    # authorization must be re-evaluated per-request, not cached from login.
    response = client.get("/admin/")
    assert response.status_code == 403


def test_is_admin_property_reflects_role_and_active_state(app, admin_user):
    with app.app_context():
        user = db.session.get(User, admin_user["user"].id)
        assert user.is_admin is True

        user.is_active = False
        assert user.is_admin is False

        user.is_active = True
        user.role = "not-a-real-role"
        assert user.is_admin is False
