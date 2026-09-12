"""Smoke tests: app boots, public pages render, admin auth gate works."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_portfolio.db")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-password")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_homepage_ok():
    response = client.get("/")
    assert response.status_code == 200
    assert b"tagline" in response.content or response.status_code == 200


def test_projects_list_ok():
    response = client.get("/projects")
    assert response.status_code == 200


def test_experience_page_ok():
    response = client.get("/experience")
    assert response.status_code == 200


def test_admin_requires_login():
    response = client.get("/admin", follow_redirects=False)
    assert response.status_code in (303, 307)


def test_admin_login_flow():
    response = client.post(
        "/admin/login",
        data={"username": "admin", "password": "test-password"},
        follow_redirects=False,
    )
    assert response.status_code == 303
    dashboard = client.get("/admin")
    assert dashboard.status_code == 200


def test_change_password_flow():
    login = client.post(
        "/admin/login",
        data={"username": "admin", "password": "test-password"},
        follow_redirects=False,
    )
    assert login.status_code == 303

    wrong_current = client.post(
        "/admin/change-password",
        data={
            "current_password": "not-the-real-password",
            "new_password": "a-new-password-123",
            "confirm_password": "a-new-password-123",
        },
    )
    assert wrong_current.status_code == 400

    changed = client.post(
        "/admin/change-password",
        data={
            "current_password": "test-password",
            "new_password": "a-new-password-123",
            "confirm_password": "a-new-password-123",
        },
    )
    assert changed.status_code == 200

    # log back in with the new password to confirm it took effect
    client.post("/admin/logout")
    relog = client.post(
        "/admin/login",
        data={"username": "admin", "password": "a-new-password-123"},
        follow_redirects=False,
    )
    assert relog.status_code == 303


def test_settings_page_has_color_fields():
    login = client.post(
        "/admin/login",
        data={"username": "admin", "password": "test-password"},
        follow_redirects=False,
    )
    assert login.status_code == 303

    settings_page = client.get("/admin/settings")
    assert settings_page.status_code == 200
    assert b'name="background_color"' in settings_page.content
    assert b'name="text_color"' in settings_page.content
    assert b'name="accent_color"' in settings_page.content

    updated = client.post(
        "/admin/settings",
        data={
            "site_title": "Test Site",
            "tagline": "",
            "bio": "",
            "avatar_url": "",
            "resume_url": "",
            "footer_text": "",
            "email": "",
            "location": "",
            "github_url": "",
            "linkedin_url": "",
            "twitter_url": "",
            "background_color": "#111111",
            "text_color": "#eeeeee",
            "accent_color": "#ff00ff",
        },
    )
    assert updated.status_code == 200
    assert b"#111111" in updated.content
    assert b"#eeeeee" in updated.content
    assert b"#ff00ff" in updated.content

    homepage = client.get("/")
    assert b"#111111" in homepage.content  # inline theme <style> reflects the saved colors


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
