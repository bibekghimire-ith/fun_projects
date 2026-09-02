"""Application factory for the portfolio platform."""

from __future__ import annotations

from datetime import UTC, datetime

from flask import Flask, render_template
from werkzeug.middleware.proxy_fix import ProxyFix

from app.common.health import health_bp
from app.common.logging import configure_logging
from app.common.security_headers import init_security_headers
from app.config import get_config
from app.extensions import csrf, db, limiter, login_manager, migrate


def create_app(config_object: type | str | None = None) -> Flask:
    """Build and configure a Flask application instance.

    Args:
        config_object: A config class, a config-map key (e.g.
            "development"/"testing"/"production"), or None. When omitted,
            resolved from the APP_ENV environment variable.
    """

    app = Flask(__name__, instance_relative_config=True)

    config_class: type
    if config_object is None or isinstance(config_object, str):
        config_class = get_config(config_object)
    else:
        config_class = config_object

    app.config.from_object(config_class)
    if hasattr(config_class, "init_app"):
        config_class.init_app(app)

    if app.config.get("TRUST_PROXY_HEADERS"):
        # Only enabled when a reverse proxy (Nginx per docs/DEPLOYMENT.md)
        # is actually in front of the app and can be trusted to overwrite
        # rather than pass through client-supplied X-Forwarded-* headers -
        # see docs/DECISIONS.md. This makes request.is_secure,
        # request.remote_addr, and generated absolute URLs reflect the
        # original client/scheme instead of the proxy's.
        proxy_count = int(app.config.get("PROXY_COUNT", 1))
        app.wsgi_app = ProxyFix(  # type: ignore[method-assign]
            app.wsgi_app,
            x_for=proxy_count,
            x_proto=proxy_count,
            x_host=proxy_count,
            x_port=proxy_count,
        )

    configure_logging(app)
    init_security_headers(app)

    db.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)
    limiter.init_app(app)

    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please log in to access this page."
    login_manager.login_message_category = "info"
    # "strong" session protection logs the user out if the session's
    # remote-addr/user-agent fingerprint changes mid-session, an extra
    # mitigation against session hijacking/fixation.
    login_manager.session_protection = "strong"

    @login_manager.user_loader
    def load_user(user_id: str):
        from app.models.user import User

        return db.session.get(User, user_id)

    app.register_blueprint(health_bp)
    _register_auth_blueprints(app)
    _register_public_blueprint(app)
    _register_seo_blueprint(app)
    _register_error_handlers(app)

    @app.context_processor
    def inject_current_year() -> dict:
        # Every public page's footer (rendered through the shared
        # themes/_layout.html -> _content_components.html:site_footer macro)
        # needs a copyright year; injecting it here means no route has to
        # remember to pass it.
        return {"current_year": datetime.now(UTC).year}

    _register_models()

    from app.cli import register_cli

    register_cli(app)

    app.logger.info("app_created", extra={"env": app.config.get("APP_ENV")})

    return app


def _register_auth_blueprints(app: Flask) -> None:
    from app.admin.routes import admin_bp
    from app.auth.routes import auth_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)


def _register_public_blueprint(app: Flask) -> None:
    from app.public.routes import public_bp

    app.register_blueprint(public_bp)


def _register_seo_blueprint(app: Flask) -> None:
    from app.seo.routes import seo_bp

    app.register_blueprint(seo_bp)


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(404)
    def not_found(_error: Exception):
        # A themed 404 - same active-template/profile/nav lookups every
        # public page uses (app/public/routes.py:_page_context), duplicated
        # narrowly here since Flask error handlers aren't blueprint routes
        # and thus can't share that helper directly.
        from app.services import nav_service, profile_service, template_service
        from app.templates_engine import registry

        profile = profile_service.get_public_profile()
        active_row = template_service.get_active_template()
        theme = registry.get_theme(active_row.key)
        html = render_template(
            "public/404.html",
            theme=theme,
            profile=profile,
            resume=None,
            nav_items=nav_service.list_visible_nav_items(),
            active_endpoint=None,
            page_title="Page not found",
            meta_description="The page you requested could not be found.",
        )
        return html, 404


def _register_models() -> None:
    """Import model modules so they register with SQLAlchemy's metadata."""

    from app import models  # noqa: F401
