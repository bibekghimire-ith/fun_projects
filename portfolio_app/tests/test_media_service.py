"""Media upload validation tests (app/services/media_service.py, Phase 7).

Uses tiny real, valid image byte sequences (real magic-number prefixes)
rather than mocks, so `sniff_image`/`validate_and_save_upload` are exercised
against actual content-sniffing logic - proving MIME validation checks
actual bytes, not the client-supplied filename/Content-Type.
"""

from __future__ import annotations

import io

import pytest
from werkzeug.datastructures import FileStorage

from app.common.storage import LocalStorageAdapter
from app.extensions import db
from app.models.media_asset import MediaAsset
from app.services import media_service
from app.services.media_service import UploadValidationError, sniff_image

# A minimal, valid 1x1 PNG.
_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000"
    "01f15c4890000000a49444154789c6360000002000155a2415a0000000049454e44ae426082"
)


@pytest.fixture()
def storage(tmp_path):
    return LocalStorageAdapter(str(tmp_path / "uploads"))


def _user(app, admin_user):
    return admin_user["user"]


def test_sniff_image_identifies_png():
    assert sniff_image(_PNG_BYTES).mime_type == "image/png"


def test_sniff_image_identifies_jpeg():
    data = b"\xff\xd8\xff\xe0" + b"\x00" * 20
    assert sniff_image(data).mime_type == "image/jpeg"


def test_sniff_image_identifies_gif():
    assert sniff_image(b"GIF89a" + b"\x00" * 10).mime_type == "image/gif"


def test_sniff_image_identifies_webp():
    data = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 10
    assert sniff_image(data).mime_type == "image/webp"


def test_sniff_image_rejects_non_image_content():
    assert sniff_image(b"<script>alert(1)</script>") is None


def test_sniff_image_rejects_html_masquerading_with_image_extension():
    # Content sniffing catches this even though a naive check might only
    # look at a client-supplied filename like "evil.png".
    assert sniff_image(b"<html><body>not an image</body></html>") is None


def test_validate_and_save_upload_accepts_a_real_png(app, admin_user, storage):
    with app.app_context():
        file_storage = FileStorage(stream=io.BytesIO(_PNG_BYTES), filename="photo.png")
        asset = media_service.validate_and_save_upload(
            file_storage,
            uploader=_user(app, admin_user),
            storage=storage,
            max_size_bytes=5 * 1024 * 1024,
        )
        assert asset.content_type == "image/png"
        assert asset.stored_name.endswith(".png")
        assert storage.open_bytes(asset.stored_name) == _PNG_BYTES
        assert db.session.get(MediaAsset, asset.id) is not None


def test_validate_and_save_upload_rejects_oversized_file(app, admin_user, storage):
    with app.app_context():
        big_but_valid_png = _PNG_BYTES + b"\x00" * 1000
        file_storage = FileStorage(stream=io.BytesIO(big_but_valid_png), filename="photo.png")
        with pytest.raises(UploadValidationError, match="exceeds the maximum"):
            media_service.validate_and_save_upload(
                file_storage,
                uploader=_user(app, admin_user),
                storage=storage,
                max_size_bytes=100,
            )
        assert db.session.query(MediaAsset).count() == 0


def test_validate_and_save_upload_rejects_disallowed_content(app, admin_user, storage):
    with app.app_context():
        file_storage = FileStorage(
            stream=io.BytesIO(b"<script>alert(1)</script>"), filename="evil.png"
        )
        with pytest.raises(UploadValidationError, match="Unsupported file type"):
            media_service.validate_and_save_upload(
                file_storage,
                uploader=_user(app, admin_user),
                storage=storage,
                max_size_bytes=5 * 1024 * 1024,
            )
        assert db.session.query(MediaAsset).count() == 0


def test_validate_and_save_upload_rejects_empty_file(app, admin_user, storage):
    with app.app_context():
        file_storage = FileStorage(stream=io.BytesIO(b""), filename="empty.png")
        with pytest.raises(UploadValidationError):
            media_service.validate_and_save_upload(
                file_storage,
                uploader=_user(app, admin_user),
                storage=storage,
                max_size_bytes=5 * 1024 * 1024,
            )


def test_validate_and_save_upload_never_uses_client_filename_as_storage_name(
    app, admin_user, storage
):
    with app.app_context():
        file_storage = FileStorage(
            stream=io.BytesIO(_PNG_BYTES), filename="../../../etc/passwd.png"
        )
        asset = media_service.validate_and_save_upload(
            file_storage,
            uploader=_user(app, admin_user),
            storage=storage,
            max_size_bytes=5 * 1024 * 1024,
        )
        assert "/" not in asset.stored_name
        assert ".." not in asset.stored_name
