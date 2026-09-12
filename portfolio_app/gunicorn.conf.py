"""Gunicorn configuration for production.

Values are tuned for a small/medium self-hosted single-instance deployment
(the target audience per docs/DEPLOYMENT.md) and are all overridable via
environment variables so a larger deployment can retune without editing
this file - see docs/DECISIONS.md for the reasoning behind each default.
"""

from __future__ import annotations

import multiprocessing
import os


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")

# sync workers (the default) are appropriate here: every request this app
# serves is a normal synchronous DB-bound request (SQLAlchemy/psycopg is
# blocking, not async), and gthread/gevent would add complexity with no
# benefit for that workload. Worker count follows the standard
# "2 x CPU + 1" formula, capped at 4 by default so a small VPS doesn't
# accidentally spawn more workers (each with its own DB connection pool)
# than it has memory for; override with GUNICORN_WORKERS for a larger box.
workers = _env_int("GUNICORN_WORKERS", min(multiprocessing.cpu_count() * 2 + 1, 4))
worker_class = os.environ.get("GUNICORN_WORKER_CLASS", "sync")
threads = _env_int("GUNICORN_THREADS", 1)

# Requests are expected to complete in well under a second (server-rendered
# Jinja2, no long-running external calls - contact-form email send is
# best-effort/non-blocking per app/common/email.py). 30s is generous
# headroom, not a target.
timeout = _env_int("GUNICORN_TIMEOUT", 30)
# How long a worker gets to finish in-flight requests after a graceful
# reload/shutdown (SIGTERM/SIGHUP) before being force-killed - keeps
# `docker compose restart`/rolling redeploys from cutting off an in-flight
# request.
graceful_timeout = _env_int("GUNICORN_GRACEFUL_TIMEOUT", 30)
keepalive = _env_int("GUNICORN_KEEPALIVE", 5)

# Recycle workers periodically (with jitter so they don't all recycle at
# once) as a defense-in-depth measure against slow memory growth in
# long-running worker processes; 0 disables it (Gunicorn's default).
max_requests = _env_int("GUNICORN_MAX_REQUESTS", 1000)
max_requests_jitter = _env_int("GUNICORN_MAX_REQUESTS_JITTER", 100)

# Do not preload the app before forking workers: this app builds its
# SQLAlchemy engine/connection pool in create_app() (the Flask application
# factory), and preloading would create that pool in the master process
# before fork, which every worker would then inherit and corrupt (a
# well-known "psycopg + os.fork()" hazard). Each worker building its own
# pool after fork (the default, preload_app=False) is the correct and safe
# behavior for a DB-backed app under Gunicorn's default sync worker model.
preload_app = False

accesslog = os.environ.get("GUNICORN_ACCESS_LOG", "-")
errorlog = os.environ.get("GUNICORN_ERROR_LOG", "-")
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")

# capture_output routes anything a worker writes to stdout/stderr (e.g. an
# uncaught exception during import) through Gunicorn's own logging instead
# of leaking directly to the container's stdout unstructured.
capture_output = True
