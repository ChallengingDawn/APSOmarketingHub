#!/bin/sh
set -e

# Next.js standalone binds to $HOSTNAME. In ECS the ambient HOSTNAME is the
# instance/ENI name (e.g. ip-172-31-x-x.eu-central-1.compute.internal), so the
# server binds only to that name and localhost / the ALB health check get
# "connection refused". Force all-interfaces. (Runs after ECS sets the env, so
# it wins over both the task definition and the Dockerfile ENV.)
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"

# Database credentials: dev/test injects DATABASE_URL directly; prod injects
# the Aurora-managed secret's parts (PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE)
# so password rotation works. The node client (src/lib/db/client.ts) assembles
# the connection string from those parts natively, URL-encoding the password —
# do NOT reintroduce shell concatenation here, it breaks on rotated passwords
# containing '@', ':', '/' or '%'.

exec node server.js
