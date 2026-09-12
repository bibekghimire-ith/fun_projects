"""Local file-upload handling for the admin panel.

Kept intentionally simple: files are validated by extension + size, then
written under app/static/uploads/ with a random filename (so nothing an
admin uploads can overwrite another file or escape the uploads directory).
The returned value is the public /static/... URL to store in a text field
(image_url, avatar_url, resume_url) exactly as if the admin had pasted an
external URL there.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

UPLOADS_DIR = Path("app/static/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
DOCUMENT_EXTENSIONS = {".pdf"}

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def _save(file: UploadFile, allowed_extensions: set[str]) -> str:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(allowed_extensions))}",
        )

    contents = file.file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).",
        )

    filename = f"{uuid.uuid4().hex}{suffix}"
    destination = UPLOADS_DIR / filename
    destination.write_bytes(contents)
    return f"/static/uploads/{filename}"


def save_image(file: UploadFile | None) -> str | None:
    if file is None or not file.filename:
        return None
    return _save(file, IMAGE_EXTENSIONS)


def save_document(file: UploadFile | None) -> str | None:
    if file is None or not file.filename:
        return None
    return _save(file, IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS)
