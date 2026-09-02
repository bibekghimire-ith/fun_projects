"""Email adapter tests (app/common/email.py, Phase 7).

Covers: the console adapter is a safe no-op (never raises, never actually
sends), the SMTP adapter constructs and sends a correct message against a
mocked `smtplib.SMTP` (no real network), and `get_email_adapter()`'s
fallback/selection logic.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.common.email import (
    ConsoleEmailAdapter,
    EmailMessage,
    SMTPEmailAdapter,
    get_email_adapter,
)


def test_console_adapter_send_returns_true_and_does_not_raise(app):
    with app.app_context():
        adapter = ConsoleEmailAdapter(app)
        result = adapter.send(EmailMessage(to="admin@example.com", subject="Hi", body="Body"))
    assert result is True


def test_get_email_adapter_defaults_to_console(app):
    app.config["MAIL_PROVIDER"] = "console"
    with app.app_context():
        adapter = get_email_adapter(app)
    assert isinstance(adapter, ConsoleEmailAdapter)


def test_get_email_adapter_falls_back_to_console_when_smtp_host_unset(app):
    app.config["MAIL_PROVIDER"] = "smtp"
    app.config["MAIL_SMTP_HOST"] = ""
    with app.app_context():
        adapter = get_email_adapter(app)
    assert isinstance(adapter, ConsoleEmailAdapter)


def test_get_email_adapter_returns_smtp_adapter_when_configured(app):
    app.config["MAIL_PROVIDER"] = "smtp"
    app.config["MAIL_SMTP_HOST"] = "smtp.example.com"
    with app.app_context():
        adapter = get_email_adapter(app)
    assert isinstance(adapter, SMTPEmailAdapter)


def test_smtp_adapter_skips_gracefully_with_no_sender_configured(app):
    app.config["MAIL_SMTP_HOST"] = "smtp.example.com"
    app.config["MAIL_DEFAULT_SENDER"] = ""
    with app.app_context():
        adapter = SMTPEmailAdapter(app)
        result = adapter.send(EmailMessage(to="admin@example.com", subject="Hi", body="Body"))
    assert result is False


def test_smtp_adapter_sends_a_correctly_constructed_message(app):
    app.config["MAIL_SMTP_HOST"] = "smtp.example.com"
    app.config["MAIL_SMTP_PORT"] = 587
    app.config["MAIL_SMTP_USERNAME"] = "user"
    app.config["MAIL_SMTP_PASSWORD"] = "pass"
    app.config["MAIL_SMTP_USE_TLS"] = True
    app.config["MAIL_DEFAULT_SENDER"] = "noreply@example.com"

    mock_smtp_instance = MagicMock()
    mock_smtp_instance.__enter__.return_value = mock_smtp_instance

    with app.app_context(), patch("smtplib.SMTP", return_value=mock_smtp_instance) as mock_smtp_cls:
        adapter = SMTPEmailAdapter(app)
        result = adapter.send(
            EmailMessage(
                to="admin@example.com",
                subject="New contact message",
                body="Someone said hi.",
                reply_to="visitor@example.com",
            )
        )

    assert result is True
    mock_smtp_cls.assert_called_once_with("smtp.example.com", 587, timeout=10)
    mock_smtp_instance.starttls.assert_called_once()
    mock_smtp_instance.login.assert_called_once_with("user", "pass")
    assert mock_smtp_instance.send_message.call_count == 1
    sent_mime = mock_smtp_instance.send_message.call_args[0][0]
    assert sent_mime["From"] == "noreply@example.com"
    assert sent_mime["To"] == "admin@example.com"
    assert sent_mime["Subject"] == "New contact message"
    assert sent_mime["Reply-To"] == "visitor@example.com"
    assert "Someone said hi." in sent_mime.get_content()


def test_smtp_adapter_does_not_use_tls_or_login_when_not_configured(app):
    app.config["MAIL_SMTP_HOST"] = "smtp.example.com"
    app.config["MAIL_SMTP_USE_TLS"] = False
    app.config["MAIL_SMTP_USERNAME"] = ""
    app.config["MAIL_SMTP_PASSWORD"] = ""
    app.config["MAIL_DEFAULT_SENDER"] = "noreply@example.com"

    mock_smtp_instance = MagicMock()
    mock_smtp_instance.__enter__.return_value = mock_smtp_instance

    with app.app_context(), patch("smtplib.SMTP", return_value=mock_smtp_instance):
        adapter = SMTPEmailAdapter(app)
        adapter.send(EmailMessage(to="admin@example.com", subject="Hi", body="Body"))

    mock_smtp_instance.starttls.assert_not_called()
    mock_smtp_instance.login.assert_not_called()
