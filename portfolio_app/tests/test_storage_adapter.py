"""Local storage adapter tests (app/common/storage.py, Phase 7)."""

from __future__ import annotations

import pytest

from app.common.storage import InvalidStorageReferenceError, LocalStorageAdapter


@pytest.fixture()
def adapter(tmp_path):
    return LocalStorageAdapter(str(tmp_path / "uploads"))


def test_save_writes_file_and_returns_a_randomized_safe_name(adapter):
    ref = adapter.save(b"hello world", "png")
    assert ref.endswith(".png")
    assert len(ref) == len("00000000000000000000000000000000.png")  # 32 hex chars + ext
    assert adapter.open_bytes(ref) == b"hello world"


def test_two_saves_produce_different_names(adapter):
    ref1 = adapter.save(b"a", "png")
    ref2 = adapter.save(b"b", "png")
    assert ref1 != ref2


def test_saved_file_is_not_executable(adapter):
    ref = adapter.save(b"data", "png")
    path = adapter.path_for(ref)
    mode = path.stat().st_mode
    assert not (mode & 0o111)  # no execute bit for owner/group/other


def test_delete_removes_the_file(adapter):
    ref = adapter.save(b"data", "png")
    adapter.delete(ref)
    assert not adapter.path_for(ref).exists()


def test_delete_of_missing_file_does_not_raise(adapter):
    adapter.delete("00000000000000000000000000000000.png")


@pytest.mark.parametrize(
    "malicious_reference",
    [
        "../../etc/passwd",
        "..%2f..%2fetc%2fpasswd",
        "/etc/passwd",
        "a/b.png",
        "..\\..\\windows\\system32",
        "notasafename.png",  # not 32 hex chars
    ],
)
def test_path_for_rejects_traversal_and_malformed_references(adapter, malicious_reference):
    with pytest.raises(InvalidStorageReferenceError):
        adapter.path_for(malicious_reference)


def test_open_bytes_rejects_traversal(adapter):
    with pytest.raises(InvalidStorageReferenceError):
        adapter.open_bytes("../../etc/passwd")
