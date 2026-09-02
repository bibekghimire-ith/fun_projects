"""HTTP security response headers.

A small, dependency-free `after_request` hook rather than Flask-Talisman -
see docs/DECISIONS.md for the rationale. Every response from this app gets:

- Content-Security-Policy: locked down to 'self' plus the one external
  host this app actually loads from (the Bootstrap CSS CDN, Phase 3) - see
  docs/DECISIONS.md for how the previously-inline theme-init script and
  the handful of inline `style="display:inline"`/`onsubmit="..."` admin
  attributes were removed so the policy needs no 'unsafe-inline'.
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY (belt-and-braces alongside CSP frame-ancestors)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: a conservative denylist of browser features this app
  never uses
- Strict-Transport-Security: only when ENABLE_HSTS is true (production by
  default - see app/config.py) and only on responses to requests the app
  believes were HTTPS, so it is never sent to a plain-HTTP client and never
  applies to local/dev/test runs by accident.
"""

from __future__ import annotations

from flask import Flask, request

_BOOTSTRAP_CDN = "https://cdn.jsdelivr.net"

_CSP = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        f"style-src 'self' {_BOOTSTRAP_CDN}",
        f"font-src 'self' {_BOOTSTRAP_CDN}",
        # Portfolio/blog content (project images, cover images, profile
        # photo) is a set of admin-entered URLs (app/models), not a fixed
        # set of hosts - see docs/DECISIONS.md for why img-src allows any
        # https origin rather than 'self' only.
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]
)

_PERMISSIONS_POLICY = ", ".join(
    [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "interest-cohort=()",
    ]
)


def init_security_headers(app: Flask) -> None:
    """Register the after_request hook that adds security headers."""

    @app.after_request
    def _add_security_headers(response):
        response.headers["Content-Security-Policy"] = _CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = _PERMISSIONS_POLICY

        if app.config.get("ENABLE_HSTS") and request.is_secure:
            max_age = int(app.config.get("HSTS_MAX_AGE", 63072000))
            response.headers["Strict-Transport-Security"] = f"max-age={max_age}; includeSubDomains"

        return response
