#!/usr/bin/env bash
# Pulls the latest Rideora version, backs up, rebuilds and restarts. Database migrations run automatically.
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/backup.sh
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
