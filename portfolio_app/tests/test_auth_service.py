"""Unit tests for app/services/auth_service.py: hashing, authentication,
and the admin bootstrap flow. No HTTP layer involved.
"""

from __future__ import annotations

from app.extensions import db
from app.models.user import User, UserRole
from app.services import auth_service


def test_hash_password_produces_argon2id_hash():
    hashed = auth_service.hash_password("correct horse battery staple")
    assert hashed.startswith("$argon2id$")


def test_hash_password_is_salted_and_nondeterministic():
    a = auth_service.hash_password("same-password")
    b = auth_service.hash_password("same-password")
    assert a != b


def test_verify_password_accepts_correct_password():
    hashed = auth_service.hash_password("s3cret-value")
    assert auth_service.verify_password(hashed, "s3cret-value") is True


def test_verify_password_rejects_wrong_password():
    hashed = auth_service.hash_password("s3cret-value")
    assert auth_service.verify_password(hashed, "wrong-value") is False


def test_verify_password_rejects_malformed_hash_without_raising():
    assert auth_service.verify_password("not-a-real-hash", "anything") is False


def test_authenticate_succeeds_for_correct_credentials(app, admin_user):
    with app.app_context():
        user = auth_service.authenticate("admin@example.com", admin_user["password"])
        assert user is not None
        assert user.email == "admin@example.com"


def test_authenticate_is_case_insensitive_on_email(app, admin_user):
    with app.app_context():
        user = auth_service.authenticate("ADMIN@EXAMPLE.COM", admin_user["password"])
        assert user is not None


def test_authenticate_fails_for_wrong_password(app, admin_user):
    with app.app_context():
        assert auth_service.authenticate("admin@example.com", "wrong-password") is None


def test_authenticate_fails_for_unknown_email(app):
    with app.app_context():
        assert auth_service.authenticate("nobody@example.com", "whatever") is None


def test_authenticate_fails_for_inactive_user(app, admin_user):
    with app.app_context():
        user = db.session.get(User, admin_user["user"].id)
        user.is_active = False
        db.session.commit()
        assert auth_service.authenticate("admin@example.com", admin_user["password"]) is None


def test_authenticate_fails_on_empty_credentials(app):
    with app.app_context():
        assert auth_service.authenticate("", "") is None
        assert auth_service.authenticate("admin@example.com", "") is None


def test_bootstrap_admin_skips_when_email_missing(app):
    app.config["ADMIN_BOOTSTRAP_EMAIL"] = ""
    with app.app_context():
        created, message = auth_service.bootstrap_admin(app)
    assert created is False
    assert "ADMIN_BOOTSTRAP_EMAIL" in message


def test_bootstrap_admin_skips_when_no_password_provided(app):
    app.config["ADMIN_BOOTSTRAP_EMAIL"] = "new-admin@example.com"
    app.config["ADMIN_BOOTSTRAP_PASSWORD_HASH"] = ""
    app.config["ADMIN_BOOTSTRAP_PASSWORD"] = ""
    with app.app_context():
        created, message = auth_service.bootstrap_admin(app)
    assert created is False
    assert "PASSWORD" in message


def test_bootstrap_admin_creates_account_from_plaintext_password(app):
    app.config["ADMIN_BOOTSTRAP_EMAIL"] = "new-admin@example.com"
    app.config["ADMIN_BOOTSTRAP_PASSWORD"] = "Sup3rSecret!!"
    app.config["ADMIN_BOOTSTRAP_PASSWORD_HASH"] = ""
    with app.app_context():
        created, message = auth_service.bootstrap_admin(app)
        assert created is True
        user = db.session.query(User).filter_by(email="new-admin@example.com").first()
        assert user is not None
        assert user.role == UserRole.ADMIN.value
        assert user.is_active is True
        assert auth_service.verify_password(user.password_hash, "Sup3rSecret!!")


def test_bootstrap_admin_creates_account_from_pre_hashed_password(app):
    pre_hashed = auth_service.hash_password("already-hashed-value")
    app.config["ADMIN_BOOTSTRAP_EMAIL"] = "hashed-admin@example.com"
    app.config["ADMIN_BOOTSTRAP_PASSWORD_HASH"] = pre_hashed
    app.config["ADMIN_BOOTSTRAP_PASSWORD"] = ""
    with app.app_context():
        created, _message = auth_service.bootstrap_admin(app)
        assert created is True
        user = db.session.query(User).filter_by(email="hashed-admin@example.com").first()
        assert user.password_hash == pre_hashed


def test_bootstrap_admin_never_overwrites_existing_account(app, admin_user):
    app.config["ADMIN_BOOTSTRAP_EMAIL"] = "admin@example.com"
    app.config["ADMIN_BOOTSTRAP_PASSWORD"] = "a-completely-different-password"
    app.config["ADMIN_BOOTSTRAP_PASSWORD_HASH"] = ""
    with app.app_context():
        created, message = auth_service.bootstrap_admin(app)
        assert created is False
        assert "already exists" in message
        user = db.session.query(User).filter_by(email="admin@example.com").first()
        # Original password still works; bootstrap did not touch it.
        assert auth_service.verify_password(user.password_hash, admin_user["password"])
