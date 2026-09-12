"""Environment-driven application configuration.

All deployment-specific values come from environment variables. Nothing in
this module hard-codes a secret, a filesystem path outside the repository,
or an environment-specific host. See .env.example for the full list of
supported variables.
"""

from __future__ import annotations

import os
from datetime import timedelta


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


class BaseConfig:
    """Shared defaults. Environment-specific configs override as needed."""

    APP_ENV = os.environ.get("APP_ENV", "production")

    SECRET_KEY = os.environ.get("SECRET_KEY", "")

    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "")
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    BASE_URL = os.environ.get("BASE_URL", "http://localhost:5000")

    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

    # Session / cookie security. Overridden for local development below.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = _env_bool("SESSION_COOKIE_SECURE", True)
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=_env_int("SESSION_LIFETIME_MINUTES", 60 * 12))

    WTF_CSRF_ENABLED = True

    # Admin bootstrap (Phase 1 uses these; declared here so .env.example is
    # complete from the foundation phase onward).
    ADMIN_BOOTSTRAP_EMAIL = os.environ.get("ADMIN_BOOTSTRAP_EMAIL", "")
    ADMIN_BOOTSTRAP_PASSWORD_HASH = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD_HASH", "")
    # Dev-only convenience: a plaintext password hashed at bootstrap time.
    # Never set this in production - use ADMIN_BOOTSTRAP_PASSWORD_HASH
    # (generate with `flask hash-password`) instead.
    ADMIN_BOOTSTRAP_PASSWORD = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "")

    # Mail adapter configuration (Phase 7 contact/email; console adapter is
    # the safe default when unset).
    MAIL_PROVIDER = os.environ.get("MAIL_PROVIDER", "console")
    MAIL_SMTP_HOST = os.environ.get("MAIL_SMTP_HOST", "")
    MAIL_SMTP_PORT = _env_int("MAIL_SMTP_PORT", 587)
    MAIL_SMTP_USERNAME = os.environ.get("MAIL_SMTP_USERNAME", "")
    MAIL_SMTP_PASSWORD = os.environ.get("MAIL_SMTP_PASSWORD", "")
    MAIL_SMTP_USE_TLS = _env_bool("MAIL_SMTP_USE_TLS", True)
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "")

    # Storage adapter configuration (Phase 7 media uploads).
    STORAGE_PROVIDER = os.environ.get("STORAGE_PROVIDER", "local")
    STORAGE_LOCAL_DIRECTORY = os.environ.get("STORAGE_LOCAL_DIRECTORY", "instance/uploads")
    MEDIA_MAX_UPLOAD_BYTES = _env_int("MEDIA_MAX_UPLOAD_BYTES", 5 * 1024 * 1024)

    # Contact form (Phase 7). Notification email is skipped gracefully (the
    # message is still persisted) when unset - see docs/DECISIONS.md.
    CONTACT_NOTIFY_EMAIL = os.environ.get("CONTACT_NOTIFY_EMAIL", "")

    # Rate limiting configuration (Phase 1/7).
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_DEFAULT = os.environ.get("RATELIMIT_DEFAULT", "200 per hour")
    LOGIN_RATE_LIMIT = os.environ.get("LOGIN_RATE_LIMIT", "5 per minute;20 per hour")
    CONTACT_RATE_LIMIT = os.environ.get("CONTACT_RATE_LIMIT", "5 per hour;20 per day")

    # Reverse proxy trust (Phase 8). Off by default: blindly trusting
    # X-Forwarded-* headers when the app is reachable directly (no proxy in
    # front) lets a client spoof its own address, which would undermine
    # rate limiting and Flask-Login's "strong" session protection (both key
    # off the perceived remote address). Only turn this on when Nginx (or
    # another reverse proxy that itself overwrites/strips inbound
    # X-Forwarded-* headers from the client) is actually in the request
    # path - see docs/DEPLOYMENT.md. PROXY_COUNT is how many proxy hops to
    # trust (Nginx alone => 1).
    TRUST_PROXY_HEADERS = _env_bool("TRUST_PROXY_HEADERS", False)
    PROXY_COUNT = _env_int("PROXY_COUNT", 1)

    # HTTP security headers (Phase 8) - see app/common/security_headers.py
    # and docs/DECISIONS.md for the policy rationale. HSTS is opt-in via
    # config (defaulted per-environment below) since it is only meaningful
    # -- and only safe to send -- once the deployment actually terminates
    # TLS in front of the app.
    ENABLE_HSTS = _env_bool("ENABLE_HSTS", False)
    HSTS_MAX_AGE = _env_int("HSTS_MAX_AGE", 63072000)  # 2 years

    @staticmethod
    def init_app(app) -> None:  # pragma: no cover - hook for subclasses
        pass


class DevelopmentConfig(BaseConfig):
    APP_ENV = "development"
    DEBUG = True
    SESSION_COOKIE_SECURE = _env_bool("SESSION_COOKIE_SECURE", False)
    # Zero-config local fallback so `flask run` works without a running
    # Postgres instance. Docker Compose and production always set
    # DATABASE_URL explicitly. See docs/DECISIONS.md.
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///instance/dev.db")


class TestingConfig(BaseConfig):
    APP_ENV = "testing"
    TESTING = True
    DEBUG = False
    WTF_CSRF_ENABLED = False
    SESSION_COOKIE_SECURE = False
    # A fixed, non-secret test-only key so sessions/CSRF/flash work in the
    # test client without requiring a SECRET_KEY environment variable.
    SECRET_KEY = os.environ.get("SECRET_KEY", "testing-secret-key-not-for-production")
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL", "sqlite:///:memory:")


class ProductionConfig(BaseConfig):
    APP_ENV = "production"
    DEBUG = False
    # HSTS defaults on in production (the deployment is expected to
    # terminate TLS in front of the app per docs/DEPLOYMENT.md); still
    # overridable via ENABLE_HSTS for a production deployment that
    # deliberately isn't HTTPS yet (e.g. first bring-up behind a proxy that
    # hasn't been given a certificate yet).
    ENABLE_HSTS = _env_bool("ENABLE_HSTS", True)

    @staticmethod
    def init_app(app) -> None:
        if not app.config.get("SECRET_KEY"):
            raise RuntimeError("SECRET_KEY environment variable is required in production.")
        if not app.config.get("SQLALCHEMY_DATABASE_URI"):
            raise RuntimeError("DATABASE_URL environment variable is required in production.")


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name: str | None = None) -> type[BaseConfig]:
    """Resolve a config class by name, falling back to APP_ENV, then production."""

    key = (name or os.environ.get("APP_ENV") or "production").lower()
    return CONFIG_MAP.get(key, ProductionConfig)
