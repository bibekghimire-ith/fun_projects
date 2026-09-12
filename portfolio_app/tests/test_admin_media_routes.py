"""Admin media upload routes + the public serving route (Phase 7).

Covers: upload requires admin auth, a valid image upload succeeds and is
served back correctly at its public URL, an oversized/wrong-MIME/malicious
upload is rejected, and the serving route rejects a path-traversal-shaped
request.
"""

from __future__ import annotations

import io

from app.extensions import db
from app.models.media_asset import MediaAsset

_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c6360000002000155a2415a0000000049454e44ae426082"
)


class TestAuthorization:
    def test_unauthenticated_upload_page_redirects_to_login(self, client):
        response = client.get("/admin/media")
        assert response.status_code == 302
        assert "/auth/login" in response.headers["Location"]

    def test_unauthenticated_upload_post_is_blocked_and_creates_nothing(self, app, client):
        data = {"file": (io.BytesIO(_PNG_BYTES), "photo.png")}
        response = client.post("/admin/media", data=data, content_type="multipart/form-data")
        assert response.status_code == 302
        with app.app_context():
            assert db.session.query(MediaAsset).count() == 0

    def test_unauthenticated_delete_is_blocked(self, client):
        response = client.post("/admin/media/00000000-0000-0000-0000-000000000000/delete")
        assert response.status_code == 302


class TestUploadAndServe:
    def test_valid_image_upload_is_persisted_and_served_back(self, app, admin_client, tmp_path):
        app.config["STORAGE_LOCAL_DIRECTORY"] = str(tmp_path / "uploads")

        data = {"file": (io.BytesIO(_PNG_BYTES), "photo.png")}
        response = admin_client.post("/admin/media", data=data, content_type="multipart/form-data")
        assert response.status_code == 302

        with app.app_context():
            assets = db.session.query(MediaAsset).all()
            assert len(assets) == 1
            asset = assets[0]
            assert asset.content_type == "image/png"

        # Served back publicly, no auth required to view (matches every
        # other *_url-style public asset in this app).
        serve_response = admin_client.get(f"/media/{asset.stored_name}")
        assert serve_response.status_code == 200
        assert serve_response.data == _PNG_BYTES

    def test_oversized_upload_is_rejected(self, app, admin_client, tmp_path):
        app.config["STORAGE_LOCAL_DIRECTORY"] = str(tmp_path / "uploads")
        app.config["MEDIA_MAX_UPLOAD_BYTES"] = 10

        data = {"file": (io.BytesIO(_PNG_BYTES), "photo.png")}
        response = admin_client.post(
            "/admin/media", data=data, content_type="multipart/form-data", follow_redirects=True
        )
        assert response.status_code == 200
        with app.app_context():
            assert db.session.query(MediaAsset).count() == 0

    def test_disallowed_content_is_rejected(self, app, admin_client, tmp_path):
        app.config["STORAGE_LOCAL_DIRECTORY"] = str(tmp_path / "uploads")

        data = {"file": (io.BytesIO(b"<script>alert(1)</script>"), "evil.png")}
        response = admin_client.post(
            "/admin/media", data=data, content_type="multipart/form-data", follow_redirects=True
        )
        assert response.status_code == 200
        with app.app_context():
            assert db.session.query(MediaAsset).count() == 0

    def test_disallowed_extension_is_rejected_by_form_validation(self, app, admin_client, tmp_path):
        app.config["STORAGE_LOCAL_DIRECTORY"] = str(tmp_path / "uploads")

        data = {"file": (io.BytesIO(b"not an image"), "malware.exe")}
        response = admin_client.post(
            "/admin/media", data=data, content_type="multipart/form-data", follow_redirects=True
        )
        assert response.status_code == 200
        with app.app_context():
            assert db.session.query(MediaAsset).count() == 0

    def test_serving_route_rejects_path_traversal_attempts(self, client):
        response = client.get("/media/..%2f..%2f..%2fetc%2fpasswd")
        assert response.status_code == 404

    def test_serving_route_404s_for_unknown_file(self, client):
        response = client.get("/media/00000000000000000000000000000000.png")
        assert response.status_code == 404

    def test_delete_removes_the_asset_and_the_file(self, app, admin_client, tmp_path):
        app.config["STORAGE_LOCAL_DIRECTORY"] = str(tmp_path / "uploads")

        data = {"file": (io.BytesIO(_PNG_BYTES), "photo.png")}
        admin_client.post("/admin/media", data=data, content_type="multipart/form-data")
        with app.app_context():
            asset = db.session.query(MediaAsset).one()
            asset_id = asset.id
            stored_name = asset.stored_name

        response = admin_client.post(f"/admin/media/{asset_id}/delete")
        assert response.status_code == 302

        with app.app_context():
            assert db.session.get(MediaAsset, asset_id) is None

        serve_response = admin_client.get(f"/media/{stored_name}")
        assert serve_response.status_code == 404
