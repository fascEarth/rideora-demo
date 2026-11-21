#!/usr/bin/env bash
# Restores a backup:  bash scripts/restore.sh backups/rideora-2026-01-01-0230.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Usage: $0 backups/file.sql.gz"; exit 1; }
read -rp "This replaces ALL current data with $1. Type yes to continue: " ok
[ "$ok" = "yes" ] || exit 1
docker compose stop app
gunzip -c "$1" | docker compose exec -T db psql -U rideora -d rideora -q
docker compose start app
echo "Restored."
