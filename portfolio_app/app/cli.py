"""Custom `flask` CLI commands."""

from __future__ import annotations

import getpass

import click
from flask import Flask, current_app

from app.services import auth_service


def register_cli(app: Flask) -> None:
    @app.cli.command("bootstrap-admin")
    def bootstrap_admin_command() -> None:
        """Idempotently create the administrator account from env vars.

        Reads ADMIN_BOOTSTRAP_EMAIL and either ADMIN_BOOTSTRAP_PASSWORD_HASH
        (preferred) or ADMIN_BOOTSTRAP_PASSWORD (dev-only). Safe to run on
        every deploy/startup - does nothing if the account already exists or
        required env vars are missing.
        """

        _created, message = auth_service.bootstrap_admin(current_app)
        click.echo(message)

    @app.cli.command("hash-password")
    @click.argument("password", required=False)
    def hash_password_command(password: str | None) -> None:
        """Print an Argon2id hash for use as ADMIN_BOOTSTRAP_PASSWORD_HASH.

        Pass the password as an argument, or omit it to be prompted (so the
        plaintext value never appears in shell history).
        """

        plaintext = password or getpass.getpass("Password: ")
        click.echo(auth_service.hash_password(plaintext))
