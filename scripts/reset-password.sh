#!/usr/bin/env bash
# Sets a new password for a staff login:  bash scripts/reset-password.sh owner@example.com 'NewPassword123'
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 2 ] || { echo "Usage: $0 email new-password"; exit 1; }
[ ${#2} -ge 8 ] || { echo "Use at least 8 characters"; exit 1; }
HASH=$(docker compose exec -T -e PW="$2" app node -e "process.stdout.write(require('bcryptjs').hashSync(process.env.PW, 10))")
docker compose exec -T db psql -U rideora -d rideora -v ON_ERROR_STOP=1 -c "update users set password_hash='${HASH}', active=true where lower(email)=lower('${1//\'/}')" | grep -q "UPDATE 1" && echo "Password updated for $1" || echo "No login found for $1"
