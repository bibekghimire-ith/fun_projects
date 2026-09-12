# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System dependencies required to build psycopg and run healthchecks.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app
COPY wsgi.py ./
COPY migrations ./migrations

RUN pip install --prefix=/install .

FROM base AS runtime

RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app

COPY --from=builder /install /usr/local
COPY app ./app
COPY wsgi.py ./
COPY migrations ./migrations
COPY gunicorn.conf.py ./

RUN mkdir -p /app/instance && chown -R app:app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

# Gunicorn tuning (workers, timeouts, worker recycling) lives in
# gunicorn.conf.py, not here - see docs/DECISIONS.md.
CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
