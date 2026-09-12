"""Structured JSON logging with per-request correlation IDs."""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from datetime import UTC, datetime

from flask import Flask, g, request

REQUEST_ID_HEADER = "X-Request-ID"


class RequestIdFilter(logging.Filter):
    """Attach the current request id (if any) to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = getattr(g, "request_id", None) if _has_app_context() else None
        return True


def _has_app_context() -> bool:
    try:
        from flask import has_request_context

        return has_request_context()
    except RuntimeError:  # pragma: no cover - defensive
        return False


_STANDARD_RECORD_ATTRS = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {
    "message",
    "asctime",
}


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON for log aggregation."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD_RECORD_ATTRS and key != "request_id":
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(app: Flask) -> None:
    """Configure structured logging and request-id correlation for the app."""

    log_level = str(app.config.get("LOG_LEVEL", "INFO")).upper()

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RequestIdFilter())

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level)

    app.logger.handlers = [handler]
    app.logger.setLevel(log_level)
    app.logger.propagate = False

    @app.before_request
    def _assign_request_id() -> None:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        g.request_id = incoming or str(uuid.uuid4())
        g.request_start_time = time.monotonic()

    @app.after_request
    def _log_request(response):
        duration_ms = None
        start_time = getattr(g, "request_start_time", None)
        if start_time is not None:
            duration_ms = round((time.monotonic() - start_time) * 1000, 2)

        response.headers[REQUEST_ID_HEADER] = getattr(g, "request_id", "")

        app.logger.info(
            "request_completed",
            extra={
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    app.logger.info("logging_configured", extra={"level": log_level})
