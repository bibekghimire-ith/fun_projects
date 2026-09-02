"""Media storage adapter abstraction (Phase 7).

CLAUDE.md's Media section: "design a storage adapter so S3-compatible/
object storage can be added later." `StorageAdapter` is the interface every
backend implements; `LocalStorageAdapter` (default, `STORAGE_PROVIDER=local`)
is the only implementation shipped in this phase - it writes to
`STORAGE_LOCAL_DIRECTORY` (default `instance/uploads`, outside `app/` so it
is never served as a static/executable path by accident) under a
randomized, extension-only filename it generates itself (never derived from
user input), and every read/write goes through `_safe_name()` which rejects
any reference containing a path separator or `..` before it ever reaches
the filesystem - the "no arbitrary path input"/"no path traversal"
requirement from CLAUDE.md's Media section and docs/SECURITY.md's Upload
security section.

Adding an S3-compatible backend later is a new class implementing the same
`save`/`open_bytes`/`delete` methods plus a new branch in
`get_storage_adapter()` - no caller (app/services/media_service.py) would
need to change.
"""

from __future__ import annotations

import re
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from flask import Flask

_SAFE_NAME_RE = re.compile(r"^[0-9a-f]{32}\.[a-z0-9]{1,10}$")


class InvalidStorageReferenceError(ValueError):
    """Raised when a stored-file reference fails the safety check."""


class StorageAdapter(ABC):
    @abstractmethod
    def save(self, data: bytes, extension: str) -> str:
        """Persist `data`, return an opaque reference (never containing a
        path/host - just a bare, randomized name) for later retrieval."""

    @abstractmethod
    def open_bytes(self, reference: str) -> bytes:
        """Read back previously-saved bytes for `reference`."""

    @abstractmethod
    def delete(self, reference: str) -> None:
        """Remove the file for `reference`, if it exists."""

    @abstractmethod
    def path_for(self, reference: str) -> Path:
        """Absolute filesystem path for `reference` (local adapter only -
        used by the serving route to stream the file); other adapters would
        not need to implement a meaningful version of this."""


def _safe_name(reference: str) -> str:
    if not _SAFE_NAME_RE.match(reference):
        raise InvalidStorageReferenceError(f"unsafe storage reference: {reference!r}")
    return reference


class LocalStorageAdapter(StorageAdapter):
    """Filesystem-backed storage under a single configured directory."""

    def __init__(self, directory: str):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, extension: str) -> str:
        # The extension is validated by the caller (app/services/
        # media_service.py) against a fixed image-type allowlist before this
        # is ever called - this adapter only ever generates the *name*, it
        # never trusts a client-supplied filename.
        name = f"{uuid.uuid4().hex}.{extension}"
        path = self.directory / name
        path.write_bytes(data)
        path.chmod(0o640)  # non-executable, owner/group read-only
        return name

    def open_bytes(self, reference: str) -> bytes:
        return self.path_for(reference).read_bytes()

    def delete(self, reference: str) -> None:
        path = self.path_for(reference)
        if path.exists():
            path.unlink()

    def path_for(self, reference: str) -> Path:
        safe = _safe_name(reference)
        path = (self.directory / safe).resolve()
        # Defense in depth beyond the regex: confirm the resolved path is
        # still inside the storage directory.
        if self.directory not in path.parents and path != self.directory:
            raise InvalidStorageReferenceError(f"path escapes storage directory: {reference!r}")
        return path


def get_storage_adapter(app: Flask) -> StorageAdapter:
    provider = (app.config.get("STORAGE_PROVIDER") or "local").strip().lower()
    if provider == "local":
        return LocalStorageAdapter(app.config.get("STORAGE_LOCAL_DIRECTORY", "instance/uploads"))
    # Any other configured provider (e.g. a future "s3") is not implemented
    # in this phase; fall back to local rather than raising at request time.
    app.logger.warning(
        "storage_provider_unrecognized_falling_back_to_local", extra={"provider": provider}
    )
    return LocalStorageAdapter(app.config.get("STORAGE_LOCAL_DIRECTORY", "instance/uploads"))
