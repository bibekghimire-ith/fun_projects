"""Media upload service (Phase 7).

Validates and persists an uploaded image: size limit, MIME validated by
sniffing actual file content (not the client-supplied filename/Content-Type
header, which cannot be trusted - docs/SECURITY.md's "content inspection"
requirement), extension allowlist, then delegates the actual bytes to the
configured `StorageAdapter` (app/common/storage.py), which generates a safe
randomized name. A `MediaAsset` row is created to track what was uploaded
and by whom (app/models/media_asset.py).
"""

from __future__ import annotations

from dataclasses import dataclass

from werkzeug.datastructures import FileStorage

from app.common.storage import StorageAdapter
from app.extensions import db
from app.models.media_asset import MediaAsset
from app.models.user import User

# Actual-content signature -> (mime type, file extension). Only these four
# raster image types are accepted - matches docs/SECURITY.md's "extension
# allowlist" + "MIME validation" + "content inspection" requirements read
# together: the extension used for storage is derived from sniffed content,
# never from the client-supplied filename.
_PNG_SIG = b"\x89PNG\r\n\x1a\n"
_JPEG_SIG = b"\xff\xd8\xff"
_GIF_SIGS = (b"GIF87a", b"GIF89a")


class UploadValidationError(ValueError):
    """Raised for any rejected upload (oversized, wrong type, empty)."""


@dataclass(frozen=True)
class SniffedImage:
    mime_type: str
    extension: str


def sniff_image(data: bytes) -> SniffedImage | None:
    """Identify an image type from its actual bytes (magic numbers), not
    its filename or client-supplied Content-Type - both of those are
    attacker-controlled and easily spoofed."""

    if data.startswith(_PNG_SIG):
        return SniffedImage("image/png", "png")
    if data.startswith(_JPEG_SIG):
        return SniffedImage("image/jpeg", "jpg")
    if data[:6] in _GIF_SIGS:
        return SniffedImage("image/gif", "gif")
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return SniffedImage("image/webp", "webp")
    return None


def validate_and_save_upload(
    file_storage: FileStorage,
    *,
    uploader: User,
    storage: StorageAdapter,
    max_size_bytes: int,
) -> MediaAsset:
    """Validate `file_storage` and persist it via `storage`.

    Raises `UploadValidationError` for any rejected upload. Never trusts
    `file_storage.filename`/`file_storage.mimetype` for the security
    decision - only the sniffed byte signature and the actual size of the
    data read matter.
    """

    if file_storage is None or not file_storage.filename:
        raise UploadValidationError("No file was provided.")

    data = file_storage.read()
    if not data:
        raise UploadValidationError("The uploaded file is empty.")
    if len(data) > max_size_bytes:
        raise UploadValidationError(
            f"The uploaded file exceeds the maximum allowed size of "
            f"{max_size_bytes // (1024 * 1024)} MB."
        )

    sniffed = sniff_image(data)
    if sniffed is None:
        raise UploadValidationError(
            "Unsupported file type. Only PNG, JPEG, GIF, and WebP images are allowed."
        )

    stored_name = storage.save(data, sniffed.extension)

    # Original filename is stored purely for the admin's own reference
    # (e.g. in the media list) - never used to build a filesystem path.
    original_name = file_storage.filename[:255]

    asset = MediaAsset(
        original_filename=original_name,
        stored_name=stored_name,
        content_type=sniffed.mime_type,
        size_bytes=len(data),
        uploaded_by_id=uploader.id,
    )
    db.session.add(asset)
    db.session.commit()
    return asset


def list_assets() -> list[MediaAsset]:
    return db.session.query(MediaAsset).order_by(MediaAsset.created_at.desc()).all()


def get_asset(asset_id) -> MediaAsset | None:
    return db.session.get(MediaAsset, asset_id)


def delete_asset(asset: MediaAsset, storage: StorageAdapter) -> None:
    storage.delete(asset.stored_name)
    db.session.delete(asset)
    db.session.commit()
