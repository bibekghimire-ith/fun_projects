"""Admin contact-message triage routes (Phase 7).

Same authorization/IDOR conventions as every other admin route family in
this app (tests/test_admin_blog_routes.py etc.): unauthenticated requests
are redirected and create no data; a nonexistent id 404s; the full
view/mark-read/archive/delete cycle works through real HTTP requests.
"""

from __future__ import annotations

from app.extensions import db
from app.models.contact_message import ContactMessage, ContactMessageStatus


def _create_message(app, **overrides):
    with app.app_context():
        message = ContactMessage(
            name=overrides.get("name", "Ada Lovelace"),
            email=overrides.get("email", "ada@example.com"),
            subject=overrides.get("subject", "Hello"),
            message=overrides.get("message", "Hi there."),
            status=overrides.get("status", ContactMessageStatus.NEW),
            ip_address=overrides.get("ip_address", "127.0.0.1"),
        )
        db.session.add(message)
        db.session.commit()
        return message.id


class TestAuthorization:
    def test_unauthenticated_list_redirects_to_login(self, client):
        response = client.get("/admin/messages")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]

    def test_unauthenticated_detail_redirects_to_login(self, app, client):
        message_id = _create_message(app)
        response = client.get(f"/admin/messages/{message_id}")
        assert response.status_code == 302

    def test_unauthenticated_status_change_is_blocked_and_does_not_change_data(self, app, client):
        message_id = _create_message(app)
        response = client.post(f"/admin/messages/{message_id}/status", data={"status": "archived"})
        assert response.status_code == 302
        with app.app_context():
            assert db.session.get(ContactMessage, message_id).status == ContactMessageStatus.NEW


class TestCrud:
    def test_list_shows_created_messages(self, app, admin_client):
        _create_message(app, name="Grace Hopper")
        response = admin_client.get("/admin/messages")
        assert response.status_code == 200
        assert b"Grace Hopper" in response.data

    def test_unknown_id_404s(self, admin_client):
        response = admin_client.get("/admin/messages/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    def test_viewing_detail_marks_new_message_as_read(self, app, admin_client):
        message_id = _create_message(app)
        response = admin_client.get(f"/admin/messages/{message_id}")
        assert response.status_code == 200
        with app.app_context():
            assert db.session.get(ContactMessage, message_id).status == ContactMessageStatus.READ

    def test_status_change_to_archived(self, app, admin_client):
        message_id = _create_message(app)
        response = admin_client.post(
            f"/admin/messages/{message_id}/status", data={"status": "archived"}
        )
        assert response.status_code == 302
        with app.app_context():
            record = db.session.get(ContactMessage, message_id)
            assert record.status == ContactMessageStatus.ARCHIVED
            assert record.processed_at is not None

    def test_invalid_status_value_is_rejected(self, app, admin_client):
        message_id = _create_message(app)
        response = admin_client.post(
            f"/admin/messages/{message_id}/status", data={"status": "not-a-real-status"}
        )
        assert response.status_code == 400

    def test_delete_removes_the_message(self, app, admin_client):
        message_id = _create_message(app)
        response = admin_client.post(f"/admin/messages/{message_id}/delete")
        assert response.status_code == 302
        with app.app_context():
            assert db.session.get(ContactMessage, message_id) is None

    def test_status_filter_narrows_the_list(self, app, admin_client):
        _create_message(app, name="New One", status=ContactMessageStatus.NEW)
        _create_message(app, name="Archived One", status=ContactMessageStatus.ARCHIVED)
        response = admin_client.get("/admin/messages?status=archived")
        assert response.status_code == 200
        assert b"Archived One" in response.data
        assert b"New One" not in response.data
