"""Tests for the `flask bootstrap-admin` and `flask hash-password` CLI
commands (app/cli.py) - the safe, no-public-registration-route way to seed
the single administrator account."""

from __future__ import annotations

from app.extensions import db
from app.models.user import User
from app.services import auth_service


def test_bootstrap_admin_cli_creates_account(app):
    app.config["ADMIN_BOOTSTRAP_EMAIL"] = "cli-admin@example.com"
    app.config["ADMIN_BOOTSTRAP_PASSWORD"] = "CliBootstrap123!"
    app.config["ADMIN_BOOTSTRAP_PASSWORD_HASH"] = ""

    runner = app.test_cli_runner()
    result = runner.invoke(args=["bootstrap-admin"])

    assert result.exit_code == 0
    assert "Created administrator account" in result.output

    with app.app_context():
        user = db.session.query(User).filter_by(email="cli-admin@example.com").first()
        assert user is not None
        assert auth_service.verify_password(user.password_hash, "CliBootstrap123!")


def test_bootstrap_admin_cli_is_idempotent(app):
    app.config["ADMIN_BOOTSTRAP_EMAIL"] = "cli-admin2@example.com"
    app.config["ADMIN_BOOTSTRAP_PASSWORD"] = "CliBootstrap123!"
    app.config["ADMIN_BOOTSTRAP_PASSWORD_HASH"] = ""

    runner = app.test_cli_runner()
    first = runner.invoke(args=["bootstrap-admin"])
    second = runner.invoke(args=["bootstrap-admin"])

    assert first.exit_code == 0
    assert second.exit_code == 0
    assert "already exists" in second.output

    with app.app_context():
        count = db.session.query(User).filter_by(email="cli-admin2@example.com").count()
        assert count == 1


def test_hash_password_cli_prints_argon2id_hash(app):
    runner = app.test_cli_runner()
    result = runner.invoke(args=["hash-password", "some-plaintext-password"])

    assert result.exit_code == 0
    assert result.output.strip().startswith("$argon2id$")
