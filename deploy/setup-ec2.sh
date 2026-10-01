#!/usr/bin/env bash
#
# ai-spark — one-shot EC2 bootstrap (Ubuntu 22.04 / 24.04).
# Installs Node + nginx + certbot + pm2, builds both apps, wires the reverse
# proxy + TLS, and starts the stack under PM2.
#
# Usage (from the repo root on the EC2 box):
#     DOMAIN=app.example.com [EMAIL=you@example.com] bash deploy/setup-ec2.sh
#
# No domain yet? Use the instance's public IP via sslip.io, e.g.:
#     DOMAIN=13-50-12-34.sslip.io bash deploy/setup-ec2.sh
#
# Re-runnable: safe to run again after pulling new code (rebuilds + reloads).

set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$DOMAIN" ] || die "Set DOMAIN, e.g.  DOMAIN=app.example.com bash deploy/setup-ec2.sh"

# --- 0. Pre-flight: env files must exist (NEXT_PUBLIC_* is baked at build time) ---
if [ ! -f backend/.env ]; then
  die "backend/.env missing. Copy deploy/backend.env.production.example -> backend/.env and fill it in."
fi
if [ ! -f frontend/.env ]; then
  die "frontend/.env missing. Copy deploy/frontend.env.production.example -> frontend/.env and set NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api"
fi

# --- 1. System packages ---
log "Installing system packages (Node 20, nginx, certbot, build tools)"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo apt-get update -y
sudo apt-get install -y nginx certbot python3-certbot-nginx build-essential
sudo npm install -g pm2

# --- 2. Build backend ---
log "Building backend"
( cd backend && npm ci && npm run build )

# --- 3. Build frontend (reads frontend/.env for NEXT_PUBLIC_API_BASE_URL) ---
log "Building frontend"
( cd frontend && npm ci && npm run build )

# --- 4. nginx reverse proxy ---
log "Configuring nginx for ${DOMAIN}"
sudo sed "s/__DOMAIN__/${DOMAIN}/g" deploy/nginx.conf | sudo tee /etc/nginx/sites-available/ai-spark >/dev/null
sudo ln -sf /etc/nginx/sites-available/ai-spark /etc/nginx/sites-enabled/ai-spark
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# --- 5. TLS via Let's Encrypt (required: the auth cookie is Secure in prod) ---
log "Obtaining TLS certificate for ${DOMAIN}"
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect \
  || die "certbot failed. Ensure ${DOMAIN}'s DNS A-record points to this box and ports 80/443 are open, then re-run."

# --- 6. Start the stack under PM2 ---
log "Starting services with PM2"
pm2 start deploy/ecosystem.config.cjs --update-env
pm2 save
# Make PM2 resurrect on reboot (prints a sudo command the first time only).
pm2 startup systemd -u "$USER" --hp "$HOME" | grep -E '^sudo ' | bash || true

log "Done. Visit: https://${DOMAIN}"
log "Health check: curl -s https://${DOMAIN}/api/health"
pm2 status
