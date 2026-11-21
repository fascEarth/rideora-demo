#!/usr/bin/env bash
# One-time server setup for a new Rideora customer on Ubuntu 22.04/24.04.
# Run from the project folder:  sudo bash scripts/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f .env ]; then
  cp .env.example .env
  read -rp "Domain for this customer (e.g. book.citycabs.com): " DOMAIN
  read -rp "Email for HTTPS certificate notices: " ACME
  read -rp "Owner's admin login email: " ADMIN
  read -rp "Region preset [dubai/london/chennai/generic]: " REGION
  ADMIN_PW=$(openssl rand -base64 12 | tr -d '/+=')
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|; s|^ACME_EMAIL=.*|ACME_EMAIL=${ACME}|; s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN}|; s|^REGION=.*|REGION=${REGION:-generic}|" .env
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -hex 24)|; s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|; s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PW}|" .env
  chmod 600 .env
  echo; echo "Admin login: ${ADMIN} / ${ADMIN_PW}  (change it after the first sign-in)"; echo
fi

# Basic firewall: SSH + web only
if command -v ufw >/dev/null; then ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null; ufw --force enable >/dev/null; fi

docker compose up -d --build
echo "Waiting for the app to start..."; sleep 20
docker compose ps

# Nightly database backup at 02:30 server time
CRON="30 2 * * * cd $(pwd) && bash scripts/backup.sh >> /var/log/rideora-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'scripts/backup.sh'; echo "$CRON" ) | crontab -
echo "Done. Open https://$(grep ^DOMAIN= .env | cut -d= -f2)/admin"
