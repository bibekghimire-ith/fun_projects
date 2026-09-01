#!/bin/sh
set -e
cd /app
# No migration history is committed to this repo (prisma/migrations does
# not exist), so `prisma migrate deploy` would silently apply nothing and
# leave the database empty. Push the schema directly instead - safe here
# since docker-compose gives Postgres a fresh, dedicated volume.
npx prisma db push --schema ./prisma/schema.prisma --skip-generate --accept-data-loss
if [ "${RUN_SEED:-false}" = "true" ]; then
  cd /app/apps/api
  npx tsx /app/prisma/seed.ts || true
fi
exec node /app/apps/api/dist/index.js
