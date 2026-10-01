#!/usr/bin/env bash
#
# ai-spark — one-shot EC2 bootstrap (Ubuntu 22.04 / 24.04).
# Self-hosted alternative to Vercel + Render: runs BOTH Next.js apps (frontend :3000,
# backend API :4000) on one box. Installs Node + nginx + certbot + pm2, builds both
# apps, wires the reverse proxy + TLS, and starts them under PM2.
#
# Usage (from the repo root on the EC2 box):
#     DOMAIN=app.example.com [EMAIL=you@example.com] bash backend/deploy/setup-ec2.sh
#
# No domain yet? Use the instance's public IP via sslip.io, e.g.:
#     DOMAIN=13-50-12-34.sslip.io bash backend/deploy/setup-ec2.sh
#
# Re-runnable: safe to run again after pulling new code (rebuilds + reloads).

set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$DOMAIN" ] || die "Set DOMAIN, e.g.  DOMAIN=app.example.com bash backend/deploy/setup-ec2.sh"

# --- 0. Pre-flight: backend secrets + frontend backend-URL ---
# Coming from the short-lived single-app layout? Its env lived in frontend/.env.
if [ ! -f backend/.env ] && grep -q '^MONGODB_URI=' frontend/.env 2>/dev/null; then
  log "Moving server secrets frontend/.env -> backend/.env"
  grep -vE '^NEXT_PUBLIC_' frontend/.env > backend/.env && chmod 600 backend/.env
  grep -E '^NEXT_PUBLIC_' frontend/.env > frontend/.env.tmp || true; mv frontend/.env.tmp frontend/.env
fi
if [ -d frontend/uploads ] && [ -n "$(ls -A frontend/uploads 2>/dev/null)" ]; then
  log "Moving frontend/uploads/* -> backend/uploads/"
  mkdir -p backend/uploads && mv -n frontend/uploads/* backend/uploads/
fi
[ -f backend/.env ] || die "backend/.env missing. Copy backend/deploy/env.production.example -> backend/.env and fill it in."
# Same-origin box: the browser reaches the backend at https://DOMAIN/api (proxy).
if ! grep -qs '^NEXT_PUBLIC_BACKEND_URL=' frontend/.env frontend/.env.local; then
  log "Setting NEXT_PUBLIC_BACKEND_URL=https://${DOMAIN} in frontend/.env.local"
  echo "NEXT_PUBLIC_BACKEND_URL=https://${DOMAIN}" >> frontend/.env.local
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

# --- 2. Build both apps (frontend reads NEXT_PUBLIC_BACKEND_URL at build time) ---
log "Building the backend"
( cd backend && npm ci && npm run build )
log "Building the frontend"
( cd frontend && npm ci && npm run build )

# --- 3. nginx reverse proxy ---
log "Configuring nginx for ${DOMAIN}"
sudo sed "s/__DOMAIN__/${DOMAIN}/g" backend/deploy/nginx.conf | sudo tee /etc/nginx/sites-available/ai-spark >/dev/null
sudo ln -sf /etc/nginx/sites-available/ai-spark /etc/nginx/sites-enabled/ai-spark
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# --- 4. TLS via Let's Encrypt (required: the auth cookie is Secure in prod) ---
log "Obtaining TLS certificate for ${DOMAIN}"
sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect \
  || die "certbot failed. Ensure ${DOMAIN}'s DNS A-record points to this box and ports 80/443 are open, then re-run."

# --- 5. Start the stack under PM2 ---
log "Starting both apps with PM2"
pm2 delete ai-spark >/dev/null 2>&1 || true   # single-app process name, if present
pm2 startOrReload backend/deploy/ecosystem.config.cjs --update-env
pm2 save
# Make PM2 resurrect on reboot (prints a sudo command the first time only).
pm2 startup systemd -u "$USER" --hp "$HOME" | grep -E '^sudo ' | bash || true

log "Done. Visit: https://${DOMAIN}"
log "Health check: curl -s https://${DOMAIN}/api/health"
pm2 status
