"""HTTP-level tests for the login/logout routes (app/auth/routes.py)."""

from __future__ import annotations


def test_login_page_renders(client):
    response = client.get("/auth/login")
    assert response.status_code == 200
    assert b"Administrator Login" in response.data


def test_login_success_redirects_to_admin_dashboard(client, admin_user):
    response = client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": admin_user["password"]},
    )
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/admin/")


def test_login_success_allows_admin_access(client, admin_user):
    client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": admin_user["password"]},
    )
    response = client.get("/admin/")
    assert response.status_code == 200
    assert b"admin@example.com" in response.data


def test_login_failure_does_not_authenticate(client, admin_user):
    response = client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": "totally-wrong"},
    )
    # Re-renders the login form (not a redirect) on failure.
    assert response.status_code == 200
    assert b"Invalid email or password" in response.data

    # And the session was never established.
    admin_response = client.get("/admin/")
    assert admin_response.status_code == 302


def test_login_failure_for_unknown_user(client):
    response = client.post(
        "/auth/login",
        data={"email": "nobody@example.com", "password": "whatever"},
    )
    assert response.status_code == 200
    assert b"Invalid email or password" in response.data


def test_already_authenticated_user_redirected_away_from_login(client, admin_user):
    client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": admin_user["password"]},
    )
    response = client.get("/auth/login")
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/admin/")


def test_logout_requires_authentication(client):
    response = client.post("/auth/logout")
    assert response.status_code == 302
    assert "/auth/login" in response.headers["Location"]


def test_logout_ends_the_session(client, admin_user):
    client.post(
        "/auth/login",
        data={"email": "admin@example.com", "password": admin_user["password"]},
    )
    assert client.get("/admin/").status_code == 200

    logout_response = client.post("/auth/logout")
    assert logout_response.status_code == 302
    assert logout_response.headers["Location"].endswith("/auth/login")

    # The prior session cookie no longer grants admin access.
    assert client.get("/admin/").status_code == 302


def test_login_get_is_not_rate_limited_by_post_attempts(client, admin_user):
    # Sanity check the GET path still renders after several failed POSTs
    # (kept well under the configured login rate limit).
    for _ in range(2):
        client.post(
            "/auth/login",
            data={"email": "admin@example.com", "password": "wrong"},
        )
    assert client.get("/auth/login").status_code == 200
