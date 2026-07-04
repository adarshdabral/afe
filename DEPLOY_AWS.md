# Deploying ai-spark on AWS (EC2 + MongoDB Atlas)

> The old `DEPLOY.md` (Cloudflare/TanStack) is **stale** — the app is now a
> **Next.js frontend** + **Express/MongoDB backend**. This is the current guide.

**Architecture:** one EC2 instance runs both apps under PM2, behind nginx as a
single-origin reverse proxy with Let's Encrypt TLS. MongoDB is hosted on Atlas.

```
                 Internet  (https://app.example.com)
                     │
              ┌──────▼──────┐   EC2 (Ubuntu)
              │   nginx :443 │   TLS terminates here
              └──┬───────┬───┘
        /        │       │  /api/*
   ┌─────────────▼─┐   ┌─▼──────────────┐
   │ Next.js :3000 │   │ Express :4000  │──► MongoDB Atlas (SRV)
   │  (PM2)        │   │  (PM2)         │
   └───────────────┘   └────────────────┘
```

Why single-origin: the auth cookie `afe_session` is `httpOnly; sameSite=lax;
secure` in production (`backend/src/utils/jwt.ts`). Serving the API under the same
HTTPS origin (`/api`) means the browser always sends it — no CORS/cookie headaches.
**TLS is mandatory** — over plain HTTP the `Secure` cookie is dropped and login silently fails.

---

## 1. MongoDB Atlas (5 min)

1. Create a free **M0** cluster at https://cloud.mongodb.com.
2. **Database Access** → add a DB user (username + strong password).
3. **Network Access** → add your EC2 instance's public IP (or `0.0.0.0/0` for a
   demo — tighten later).
4. **Connect → Drivers** → copy the SRV string. Add the db name before the query:
   `...mongodb.net/ai-spark?retryWrites=true&w=majority`.

> ⚠️ The previously-committed `backend/.env.example` leaked a real Atlas
> credential (`adarshchampawat:...`). It's been sanitized — **rotate/disable that
> Atlas user** if it still exists.

## 2. Launch the EC2 instance

- **AMI:** Ubuntu Server 24.04 LTS · **Type:** t3.small (2 GB) recommended
  (t2.micro/1 GB free-tier works but `next build` may need swap — see Troubleshooting).
- **Key pair:** reuse your existing `key.pem` (now git-ignored — keep it secret).
- **Security group inbound:** `22` (SSH, your IP only), `80` (HTTP), `443` (HTTPS).
- Allocate an **Elastic IP** and associate it so the address is stable.

## 3. DNS / hostname

- **Have a domain?** Add an **A record** → the Elastic IP. Use that as `DOMAIN`.
- **No domain?** Use sslip.io: for IP `13.50.12.34`, `DOMAIN=13-50-12-34.sslip.io`.
  It resolves to the IP and lets certbot issue a real cert.

## 4. Deploy

SSH in and get the code onto the box (git clone, or `scp`/`rsync` — do **not**
copy `node_modules`, `.env`, or `key.pem`):

```bash
ssh -i key.pem ubuntu@<ELASTIC_IP>
git clone <your-repo-url> ai-spark && cd ai-spark   # or rsync the source up
```

Create the two env files from the templates and fill them in:

```bash
cp deploy/backend.env.production.example  backend/.env
cp deploy/frontend.env.production.example frontend/.env
nano backend/.env      # MONGODB_URI, JWT_SECRET (openssl rand -base64 48), CORS_ORIGIN, seed pwds
nano frontend/.env     # NEXT_PUBLIC_API_BASE_URL=https://<DOMAIN>/api
```

Run the bootstrap (installs Node/nginx/certbot/pm2, builds both, wires TLS, starts PM2):

```bash
DOMAIN=app.example.com EMAIL=you@example.com bash deploy/setup-ec2.sh
```

Verify:

```bash
curl -s https://app.example.com/api/health     # -> {"data":{"ok":true}}
pm2 status                                      # both apps "online"
```

Open `https://app.example.com` and log in with a seed account
(`student@afe.edu` / your `SEED_STUDENT_PASSWORD`).

## 5. Redeploying after code changes

```bash
cd ai-spark && git pull
( cd backend  && npm ci && npm run build )
( cd frontend && npm ci && npm run build )   # rebuild needed for NEXT_PUBLIC_* changes
pm2 reload deploy/ecosystem.config.cjs --update-env
```

---

## Operational notes

- **Logs:** `pm2 logs ai-spark-api` / `pm2 logs ai-spark-web`. nginx: `/var/log/nginx/`.
- **TLS renewal:** certbot installs a systemd timer; auto-renews. Test: `sudo certbot renew --dry-run`.
- **Restart on reboot:** handled by `pm2 save` + `pm2 startup` in the bootstrap.

## Production caveats (carried over from the audit)

1. **Seeding on every boot.** `backend/src/index.ts` re-runs `seedDemoUsers` /
   `seedAnalyticsCohort` / `seedForum` at startup. Seeds are idempotent, but the
   weak demo passwords are live accounts — set strong `SEED_*` values.
2. **Single instance = single point of failure.** No load balancing/HA. Fine for
   a demo/MVP; for HA move to an ALB + Auto Scaling or ECS later.
3. **Atlas network access.** Don't leave `0.0.0.0/0` open in production — restrict
   to the Elastic IP.

## Troubleshooting

- **`next build` killed / OOM on a 1 GB instance:** add swap, then rebuild:
  `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
- **certbot fails:** DNS A-record must point at the box and ports 80/443 open in
  the security group *before* running it. Fix, then re-run `deploy/setup-ec2.sh`.
- **Login appears to do nothing:** you're on HTTP, not HTTPS — the `Secure` cookie
  is being dropped. Confirm certbot succeeded and you're visiting `https://`.
- **502 Bad Gateway:** an app crashed — check `pm2 logs`. Usually a bad
  `MONGODB_URI` or a missing/short `JWT_SECRET` (must be ≥32 chars in production).
```
