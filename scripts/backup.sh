#!/usr/bin/env bash
# Dumps the database to ./backups and keeps the last 14 days. Copy ./backups off the server regularly.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
f="backups/rideora-$(date +%F-%H%M).sql.gz"
docker compose exec -T db pg_dump -U rideora -d rideora --clean --if-exists | gzip > "$f"
find backups -name 'rideora-*.sql.gz' -mtime +14 -delete
echo "Backup written: $f"
