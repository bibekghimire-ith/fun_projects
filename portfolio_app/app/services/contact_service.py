"""Contact message service (Phase 7).

`create_message()` is the single write path for a new contact submission -
always persists the message (contact form data should never be lost just
because notification email isn't configured/fails), then makes a
best-effort attempt to notify the admin via the configured
`EmailAdapter` (app/common/email.py). A notification failure/skip never
raises back to the caller - see docs/DECISIONS.md's "graceful when email is
not configured" write-up.

The admin-triage CRUD functions below (`list_messages`/`get_message`/
`mark_read`/`mark_archived`/`delete_message`) follow the same "fetch by id,
None on no match, 404 in the route layer" IDOR-guard-free pattern every
other *global* (unscoped) entity in this app uses (e.g. `blog_category_
service`) - there is exactly one admin, so no ownership scoping is needed,
only existence.
"""

from __future__ import annotations

import uuid

from flask import Flask

from app.common.email import EmailMessage, get_email_adapter
from app.extensions import db
from app.models.base import utcnow
from app.models.contact_message import ContactMessage, ContactMessageStatus


def create_message(
    *, name: str, email: str, subject: str | None, message: str, ip_address: str | None
) -> ContactMessage:
    record = ContactMessage(
        name=name.strip(),
        email=email.strip(),
        subject=(subject or "").strip() or None,
        message=message.strip(),
        status=ContactMessageStatus.NEW,
        ip_address=ip_address,
    )
    db.session.add(record)
    db.session.commit()
    return record


def notify_new_message(app: Flask, record: ContactMessage) -> bool:
    """Best-effort admin notification. Returns whether an email was
    actually handed to the adapter; never raises - a broken/unconfigured
    mail setup must never break the contact flow (the message is already
    persisted by the time this is called)."""

    recipient = app.config.get("CONTACT_NOTIFY_EMAIL") or ""
    if not recipient:
        app.logger.info("contact_notify_skipped_no_recipient_configured")
        return False

    adapter = get_email_adapter(app)
    body = (
        f"New contact form submission from {record.name} <{record.email}>\n\n"
        f"Subject: {record.subject or '(none)'}\n\n"
        f"{record.message}\n"
    )
    try:
        return adapter.send(
            EmailMessage(
                to=recipient,
                subject=f"New contact message: {record.subject or 'no subject'}",
                body=body,
                reply_to=record.email,
            )
        )
    except Exception:  # noqa: BLE001 - best-effort, never let mail break contact
        app.logger.exception("contact_notify_failed")
        return False


def list_messages(status: str | None = None) -> list[ContactMessage]:
    query = db.session.query(ContactMessage)
    if status:
        query = query.filter(ContactMessage.status == status)
    return query.order_by(ContactMessage.created_at.desc()).all()


def get_message(message_id: uuid.UUID) -> ContactMessage | None:
    return db.session.get(ContactMessage, message_id)


def mark_status(record: ContactMessage, status: str) -> ContactMessage:
    if status not in ContactMessageStatus.ALL:
        raise ValueError(f"Unknown status: {status!r}")
    record.status = status
    record.processed_at = utcnow()
    db.session.commit()
    return record


def delete_message(record: ContactMessage) -> None:
    db.session.delete(record)
    db.session.commit()
