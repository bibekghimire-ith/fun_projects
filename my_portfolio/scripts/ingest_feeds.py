"""CLI entry point for the feed ingestion pipeline -- run on a schedule
(cron) to poll every enabled FeedSource for new articles and create draft
Posts for review in /admin/posts.

Usage:
    python scripts/ingest_feeds.py

Example crontab line (every 30 minutes):
    */30 * * * *  cd /path/to/my_portfolio && python scripts/ingest_feeds.py >> /var/log/portfolio-ingest.log 2>&1

Exit code is non-zero only when *every* configured source errored (so a
cron failure-notification setup has something to alert on) -- a single
source failing among several healthy ones still exits 0, since that's
recorded per-source in the admin UI (`/admin/sources`) rather than being
a fatal run.

Mirrors the existing scripts/load_content.py pattern: a standalone script
that opens its own DB session against app.database.SessionLocal rather
than going through the FastAPI dependency-injection path.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.ingestion import run_ingestion  # noqa: E402


def main() -> int:
    db = SessionLocal()
    try:
        summary = run_ingestion(db)
    finally:
        db.close()

    print(summary.as_text())

    if summary.results and all(r.status == "error" for r in summary.results):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
