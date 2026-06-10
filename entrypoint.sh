#!/bin/sh
set -e

# The app reads a single DATABASE_URL. In dev/test we inject DATABASE_URL
# directly as a secret. In prod we inject the Aurora-managed secret's parts
# (PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE) so password rotation works —
# assemble DATABASE_URL from them here, with no app code change.
if [ -z "$DATABASE_URL" ] && [ -n "$PGHOST" ]; then
  export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}"
fi

exec node server.js
