"""Smoke tests for the platform health/readiness endpoints."""

from __future__ import annotations


def test_healthz_returns_ok(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_readyz_returns_ready_when_db_reachable(client):
    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ready"}


def test_healthz_response_includes_request_id_header(client):
    response = client.get("/healthz")

    assert "X-Request-ID" in response.headers
    assert response.headers["X-Request-ID"] != ""
