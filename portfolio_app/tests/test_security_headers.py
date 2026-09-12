"""Phase 8: HTTP security response headers (app/common/security_headers.py)."""

from __future__ import annotations

import pytest

from app import create_app


def test_headers_present_on_health_endpoint(client):
    response = client.get("/healthz")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "Permissions-Policy" in response.headers
    csp = response.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "object-src 'none'" in csp


def test_csp_has_no_unsafe_inline_or_unsafe_eval(client):
    response = client.get("/healthz")

    csp = response.headers["Content-Security-Policy"]
    assert "unsafe-inline" not in csp
    assert "unsafe-eval" not in csp


def test_csp_allows_bootstrap_cdn_for_styles_only(client):
    response = client.get("/healthz")

    csp = response.headers["Content-Security-Policy"]
    assert "style-src 'self' https://cdn.jsdelivr.net" in csp
    # script-src must stay 'self' only - no external script host is needed
    # or allowed (see docs/DECISIONS.md).
    assert "script-src 'self'" in csp
    assert "script-src 'self' https://cdn.jsdelivr.net" not in csp


def test_hsts_absent_by_default_over_plain_http(client):
    # TestingConfig doesn't enable HSTS, and even if it did, the Flask test
    # client's requests aren't flagged as secure.
    response = client.get("/healthz")

    assert "Strict-Transport-Security" not in response.headers


def test_hsts_sent_when_enabled_and_request_is_secure():
    app = create_app("testing")
    app.config["ENABLE_HSTS"] = True
    with app.app_context():
        from app.extensions import db as _db

        _db.create_all()
        try:
            client = app.test_client()
            response = client.get("/healthz", base_url="https://example.test")
            assert (
                response.headers["Strict-Transport-Security"]
                == "max-age=63072000; includeSubDomains"
            )
        finally:
            _db.session.remove()
            _db.drop_all()


def test_hsts_not_sent_when_enabled_but_request_is_plain_http():
    app = create_app("testing")
    app.config["ENABLE_HSTS"] = True
    with app.app_context():
        from app.extensions import db as _db

        _db.create_all()
        try:
            client = app.test_client()
            response = client.get("/healthz", base_url="http://example.test")
            assert "Strict-Transport-Security" not in response.headers
        finally:
            _db.session.remove()
            _db.drop_all()


@pytest.mark.parametrize("path", ["/", "/blog", "/auth/login"])
def test_security_headers_present_on_public_pages(client, path):
    response = client.get(path)

    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert "Content-Security-Policy" in response.headers


def test_production_config_defaults_hsts_on():
    from app.config import ProductionConfig

    assert ProductionConfig.ENABLE_HSTS is True


def test_proxy_headers_untrusted_by_default(app):
    assert app.config["TRUST_PROXY_HEADERS"] is False
