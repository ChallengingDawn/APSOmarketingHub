#!/bin/sh
set -e

# Next.js standalone binds to $HOSTNAME. In ECS the ambient HOSTNAME is the
# instance/ENI name (e.g. ip-172-31-x-x.eu-central-1.compute.internal), so the
# server binds only to that name and localhost / the ALB health check get
# "connection refused". Force all-interfaces. (Runs after ECS sets the env, so
# it wins over both the task definition and the Dockerfile ENV.)
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

# The app reads a single DATABASE_URL. In dev/test we inject DATABASE_URL
# directly as a secret. In prod we inject the Aurora-managed secret's parts
# (PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE) so password rotation works —
# assemble DATABASE_URL from them here, with no app code change.
if [ -z "$DATABASE_URL" ] && [ -n "$PGHOST" ]; then
  export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}"
fi

exec node server.js
