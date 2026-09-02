"""Email adapter abstraction (Phase 7).

CLAUDE.md's Contact section requires a "configurable email adapter" with
"graceful behavior when email is not configured." Two adapters are provided:

- `ConsoleEmailAdapter` (default, `MAIL_PROVIDER=console`): logs the message
  via the app's structured logger instead of sending it. Safe default for a
  self-hosted install with no SMTP server configured - the contact form
  still works (the message is persisted by app/services/contact_service.py
  regardless of which adapter is active), it just doesn't email anyone.
- `SMTPEmailAdapter` (`MAIL_PROVIDER=smtp`): sends via `smtplib` against
  `MAIL_SMTP_HOST`/`MAIL_SMTP_PORT`/`MAIL_SMTP_USERNAME`/`MAIL_SMTP_PASSWORD`/
  `MAIL_SMTP_USE_TLS`/`MAIL_DEFAULT_SENDER` - all environment-variable
  configured per CLAUDE.md rule #7/#8 ("use environment variables for
  deployment-specific configuration", "never hard-code secrets").

`get_email_adapter()` is the only factory calling code should use - nothing
outside this module imports `smtplib` directly, matching the existing
"external integrations behind adapters" convention (CLAUDE.md rule #19,
already applied to auth's argon2 wrapper and the blog Markdown/sanitizer
pair). If `MAIL_PROVIDER=smtp` but the SMTP host is not configured, this
falls back to the console adapter with a warning log rather than raising -
a misconfigured/unset mail provider must never break the contact form
itself (see docs/DECISIONS.md).
"""

from __future__ import annotations

import smtplib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from email.message import EmailMessage as MimeEmailMessage

from flask import Flask


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    body: str
    reply_to: str | None = None


class EmailAdapter(ABC):
    """Adapter interface every email backend implements."""

    @abstractmethod
    def send(self, message: EmailMessage) -> bool:
        """Send `message`. Returns True if the message was handed off/sent,
        False if sending was skipped (e.g. no recipient configured). Never
        raises for an expected "not configured" condition - callers treat a
        failed send as best-effort/non-fatal (see
        app/services/contact_service.py)."""


class ConsoleEmailAdapter(EmailAdapter):
    """Default, safe-for-self-hosted adapter: logs instead of sending."""

    def __init__(self, app: Flask):
        self._app = app

    def send(self, message: EmailMessage) -> bool:
        self._app.logger.info(
            "email_console_adapter_send",
            extra={"to": message.to, "subject": message.subject},
        )
        return True


class SMTPEmailAdapter(EmailAdapter):
    """Sends real email via SMTP. Credentials/host are read once from the
    app's config at construction time - never hard-coded, never logged."""

    def __init__(self, app: Flask):
        self._app = app
        self._host = app.config.get("MAIL_SMTP_HOST", "")
        self._port = app.config.get("MAIL_SMTP_PORT", 587)
        self._username = app.config.get("MAIL_SMTP_USERNAME", "")
        self._password = app.config.get("MAIL_SMTP_PASSWORD", "")
        self._use_tls = app.config.get("MAIL_SMTP_USE_TLS", True)
        self._sender = app.config.get("MAIL_DEFAULT_SENDER", "")

    def send(self, message: EmailMessage) -> bool:
        if not self._sender:
            self._app.logger.warning("email_smtp_adapter_skipped_no_sender")
            return False

        mime = MimeEmailMessage()
        mime["From"] = self._sender
        mime["To"] = message.to
        mime["Subject"] = message.subject
        if message.reply_to:
            mime["Reply-To"] = message.reply_to
        mime.set_content(message.body)

        with smtplib.SMTP(self._host, self._port, timeout=10) as smtp:
            if self._use_tls:
                smtp.starttls()
            if self._username and self._password:
                smtp.login(self._username, self._password)
            smtp.send_message(mime)
        self._app.logger.info("email_smtp_adapter_sent", extra={"to": message.to})
        return True


def get_email_adapter(app: Flask) -> EmailAdapter:
    """Resolve the configured adapter for `app`. Never raises - an
    unrecognized or unusable `MAIL_PROVIDER` falls back to the console
    adapter so the contact form always works even with bad mail config."""

    provider = (app.config.get("MAIL_PROVIDER") or "console").strip().lower()
    if provider == "smtp":
        if not app.config.get("MAIL_SMTP_HOST"):
            app.logger.warning("mail_provider_smtp_missing_host_falling_back_to_console")
            return ConsoleEmailAdapter(app)
        return SMTPEmailAdapter(app)
    return ConsoleEmailAdapter(app)
