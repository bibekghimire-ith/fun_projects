# Backups

Two things need backing up: the PostgreSQL database (all portfolio/blog/
auth/contact content) and the local media storage directory (uploaded
images, when `STORAGE_PROVIDER=local` - see `app/common/storage.py` and
docs/DECISIONS.md #46). Neither backs up the other - a database backup
alone would leave `MediaAsset` rows pointing at files that no longer
exist, and a media backup alone is just anonymous files with no metadata.
Back up both, ideally in the same backup run, so they stay consistent.

## PostgreSQL

### Backup

Using the `docker-compose.yml` `db` service:

```
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-portfolio}" \
  -d "${POSTGRES_DB:-portfolio}" \
  --format=custom \
  --file=/tmp/portfolio-$(date +%Y%m%d-%H%M%S).dump

docker compose cp db:/tmp/portfolio-<timestamp>.dump ./backups/
docker compose exec -T db rm /tmp/portfolio-<timestamp>.dump
```

Or, without going through the container filesystem (pipes the dump
straight to the host):

```
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-portfolio}" \
  -d "${POSTGRES_DB:-portfolio}" \
  --format=custom \
  > ./backups/portfolio-$(date +%Y%m%d-%H%M%S).dump
```

`--format=custom` (not plain SQL) is used because it's compressed and
supports selective/parallel restore via `pg_restore`. Against a managed
PostgreSQL instance (production, per docs/DEPLOYMENT.md), run the same
`pg_dump` command directly against `DATABASE_URL` instead of through
`docker compose exec`:

```
pg_dump "$DATABASE_URL" --format=custom --file=./backups/portfolio-$(date +%Y%m%d-%H%M%S).dump
```

Automate this with cron (or your platform's scheduled-job equivalent)
outside the container - e.g. a host crontab entry running the `docker
compose exec` form nightly, retaining some number of days per your
storage budget. This app deliberately does not ship a backup cron job
inside the `app`/`db` containers themselves (per docs/DEPLOYMENT.md's
"do not depend on... Linux-only shell scripts" portability rule and
CLAUDE.md's "no unnecessary microservices" - backup scheduling is an
operational/infrastructure concern, not application functionality).

### Restore

Into a fresh/empty database (never restore over a live database you still
need - see "Restore safety" below):

```
docker compose exec -T db pg_restore \
  -U "${POSTGRES_USER:-portfolio}" \
  -d "${POSTGRES_DB:-portfolio}" \
  --clean --if-exists \
  < ./backups/portfolio-<timestamp>.dump
```

`--clean --if-exists` drops existing objects before recreating them, so
this is also how to restore into a database that already has an (older,
being replaced) schema. Against a managed instance:

```
pg_restore "$DATABASE_URL" --clean --if-exists ./backups/portfolio-<timestamp>.dump
```

After restoring, run `flask db upgrade` (see "Migration procedure" in
docs/DEPLOYMENT.md) in case the backup predates a migration that has
since been applied to the codebase you're restoring into.

### Restore safety
- Take a fresh backup of the *current* (about-to-be-overwritten) database
  before restoring an old one, in case the restore needs to be undone.
- `--clean --if-exists` will drop tables not in the dump too (if the
  target schema has diverged) - restore into a throwaway/staging database
  first when in doubt, then promote it, rather than restoring directly
  onto production.
- The dump contains user emails, password hashes (Argon2id - not
  reversible, but still sensitive), and contact-form submitter emails.
  Store backups with the same access control you'd give the live database
  - never commit them to version control (see `.gitignore`), never attach
  them to a public issue/support ticket.

## Media storage (local uploads)

`STORAGE_LOCAL_DIRECTORY` (default `instance/uploads`) holds every file
uploaded through `/admin/media` (app/services/media_service.py). In
`docker-compose.yml` this directory is the `media_uploads` named volume,
mounted at `/app/instance` on the `app`/`migrate` services (see
docs/DECISIONS.md #55 - it's the one directory kept writable under an
otherwise read-only container filesystem).

### Backup

```
docker run --rm \
  -v portfolio_app_media_uploads:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine tar -czf /backup/media-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

(Replace `portfolio_app_media_uploads` with the actual volume name -
`docker volume ls` to confirm; Compose prefixes it with the project name,
e.g. `<project>_media_uploads`.) If you deploy outside Docker entirely
(a bare VPS running Gunicorn directly), just `tar`/`rsync`
`STORAGE_LOCAL_DIRECTORY` directly - it's a plain directory of files named
by randomized UUID hex (see docs/DECISIONS.md #46), safe to archive with
any standard tool.

### Restore

```
docker run --rm \
  -v portfolio_app_media_uploads:/data \
  -v "$(pwd)/backups":/backup \
  alpine sh -c "rm -rf /data/* && tar -xzf /backup/media-<timestamp>.tar.gz -C /data"
```

Restore the media backup from the same point in time as the database
backup you're restoring - `MediaAsset` rows in the database reference
files by stored name (`app/common/storage.py`'s
`^[0-9a-f]{32}\.[a-z0-9]{1,10}$` naming), so a mismatched pair leaves
either orphaned files (harmless, just wasted space) or `MediaAsset` rows
whose files 404 on `/media/<stored_name>` (a visible broken-image issue,
not a security issue - `public.media_file`'s path-traversal-proof lookup
still applies).

### If/when object storage (S3-compatible) is added later
`app/common/storage.py`'s `StorageAdapter` interface (docs/DECISIONS.md
#46) was designed so a future S3-compatible backend needs no caller
changes. Once added, backups shift to whatever mechanism the object
storage provider offers (cross-region replication, versioning, provider-
side snapshots) instead of this section's `tar`/volume approach - update
this document at that point.

## Retention and verification
- Keep at minimum: the last 7 daily backups and the last 4 weekly
  backups, adjusted to your actual data-loss tolerance and storage
  budget - this project does not prescribe a specific retention window,
  since that's a deployment-specific tradeoff, not an application
  concern.
- Periodically test a restore into a scratch database/volume (not
  production) - an untested backup is not a verified backup. The
  `pg_dump --format=custom` / `pg_restore --clean --if-exists` pair above
  (direct-`psql`/`pg_dump` form, not the `docker compose exec` wrapper -
  no Docker daemon was available in this build session, see
  docs/IMPLEMENTATION_STATE.md) was actually run against this project's
  disposable PostgreSQL 16 instance in Phase 8: dumped a database
  containing a real contact-form submission created via a live end-to-end
  curl flow, restored it into a separate freshly-created database, and
  confirmed the row (`name`, `email`) came back intact. The Docker-volume
  form of the media-backup commands was not executed (same no-Docker-
  daemon constraint) - it's a standard `docker run --rm -v ... tar`
  pattern with nothing portfolio-app-specific in it.
