"""Health and readiness endpoints.

/healthz reports liveness only (the process is up and serving requests).
/readyz additionally verifies the database connection is reachable, which is
what orchestrators should use to decide whether to route traffic.
"""

from __future__ import annotations

from flask import Blueprint, current_app, jsonify
from sqlalchemy import text

from app.extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.get("/healthz")
def healthz():
    return jsonify(status="ok"), 200


@health_bp.get("/readyz")
def readyz():
    try:
        db.session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - readiness must not leak internals
        current_app.logger.error("readiness_check_failed", extra={"error": str(exc)})
        return jsonify(status="unavailable"), 503

    return jsonify(status="ready"), 200
