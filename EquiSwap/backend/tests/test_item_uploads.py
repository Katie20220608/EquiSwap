"""Tests for POST /items/upload-image."""

import os
import shutil
from pathlib import Path

import pytest

UPLOAD_DIR = Path(
    os.getenv("UPLOAD_DIR", str(Path(__file__).resolve().parents[1] / "test_uploads"))
).resolve()


def _register_login(client, name: str, email: str, password: str = "password123") -> str:
    client.post("/auth/register", json={"name": name, "email": email, "password": password})
    return client.post("/auth/login", data={"username": email, "password": password}).json()["access_token"]


@pytest.fixture(autouse=True)
def cleanup_uploads():
    yield
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR)


def test_upload_image_requires_authentication(client):
    res = client.post(
        "/items/upload-image",
        files={"file": ("photo.png", b"fake-bytes", "image/png")},
    )
    assert res.status_code == 401


def test_upload_image_saves_file_and_returns_url(client):
    token = _register_login(client, "Alice", "alice@example.com")
    res = client.post(
        "/items/upload-image",
        files={"file": ("photo.png", b"fake-bytes", "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    url = res.json()["url"]
    assert url.startswith("/uploads/")
    assert url.endswith(".png")
    assert (UPLOAD_DIR / url.removeprefix("/uploads/")).exists()


def test_upload_image_rejects_unsupported_content_type(client):
    token = _register_login(client, "Alice", "alice@example.com")
    res = client.post(
        "/items/upload-image",
        files={"file": ("doc.pdf", b"fake-bytes", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422


def test_upload_image_rejects_oversized_file(client):
    token = _register_login(client, "Alice", "alice@example.com")
    oversized = b"0" * (5 * 1024 * 1024 + 1)
    res = client.post(
        "/items/upload-image",
        files={"file": ("photo.png", oversized, "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422
