#!/bin/sh
set -e
cd /app
npx prisma migrate deploy --schema ./prisma/schema.prisma
if [ "${RUN_SEED:-false}" = "true" ]; then
  cd /app/apps/api
  npx tsx /app/prisma/seed.ts || true
fi
exec node /app/apps/api/dist/index.js
