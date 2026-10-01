# Self-hosting ai-spark on AWS (EC2 + MongoDB Atlas)

> The primary deployment is **frontend on Vercel + backend on Render** — see
> **`DEPLOY.md`**. This guide is the self-hosted alternative: both Next.js apps
> (`frontend/` UI on :3000, `backend/` API on :4000) on one EC2 box under PM2,
> behind a reverse proxy (Apache on the live box, or nginx) with Let's Encrypt TLS.
> Config files live in **`backend/deploy/`**.

```
             Internet  (https://app.example.com)
                 │
          ┌──────▼───────┐   EC2 (Ubuntu)
          │ proxy  :443   │   TLS terminates here (Apache or nginx)
          └──┬────────┬───┘
       /     │        │  /api/*
   ┌─────────▼───┐  ┌─▼───────────────┐
   │ frontend    │  │ backend  :4000  │──► MongoDB Atlas (SRV)
   │ :3000 (PM2) │  │ (PM2)           │──► backend/uploads/ (lesson files)
   └─────────────┘  └─────────────────┘
```

Why single-origin: the auth cookie `afe_session` is `httpOnly; sameSite=lax;
secure` in production (`backend/server/utils/jwt.ts`). Pages and API share one
HTTPS origin, so the browser always sends it — no cookie headaches.
**TLS is mandatory** — over plain HTTP the `Secure` cookie is dropped and login silently fails.

---

## 1. MongoDB Atlas (5 min)

1. Create a free **M0** cluster at https://cloud.mongodb.com.
2. **Database Access** → add a DB user (username + strong password).
3. **Network Access** → add your EC2 instance's public IP (or `0.0.0.0/0` for a
   demo — tighten later).
4. **Connect → Drivers** → copy the SRV string. Add the db name before the query:
   `...mongodb.net/ai-spark?retryWrites=true&w=majority`.

## 2. Launch the EC2 instance

- **AMI:** Ubuntu Server 24.04 LTS · **Type:** t3.small (2 GB) recommended
  (t2.micro/1 GB free-tier works but `next build` may need swap — see Troubleshooting).
- **Key pair:** reuse your existing `key.pem` (git-ignored — keep it secret).
- **Security group inbound:** `22` (SSH, your IP only), `80` (HTTP), `443` (HTTPS).
- Allocate an **Elastic IP** and associate it so the address is stable.
- **Disk:** uploaded lesson videos (up to 500 MB each) live on this disk — size the
  EBS volume accordingly.

## 3. DNS / hostname

- **Have a domain?** Add an **A record** → the Elastic IP. Use that as `DOMAIN`.
- **No domain?** Use sslip.io: for IP `13.50.12.34`, `DOMAIN=13-50-12-34.sslip.io`.

## 4. Deploy

```bash
ssh -i key.pem ubuntu@<ELASTIC_IP>
git clone <your-repo-url> ai-spark && cd ai-spark
cp backend/deploy/env.production.example backend/.env
nano backend/.env     # MONGODB_URI, JWT_SECRET (openssl rand -base64 48),
                      # APP_PUBLIC_URL + CORS_ORIGIN = https://<DOMAIN>, seed pwds
DOMAIN=app.example.com EMAIL=you@example.com bash backend/deploy/setup-ec2.sh
```

The bootstrap installs Node/nginx/certbot/pm2, writes
`frontend/.env.local` with `NEXT_PUBLIC_BACKEND_URL=https://<DOMAIN>` (the proxy
routes `/api` to the backend), builds both apps, wires TLS and starts PM2. Verify:

```bash
curl -s https://app.example.com/api/health     # -> {"data":{"ok":true}}
pm2 status                                      # ai-spark-api + ai-spark-web online
```

Seed the course content once (destructive to any other course — see CLAUDE.md):

```bash
cd backend && npm run seed
```

## 5. Redeploying after code changes

```bash
cd ai-spark && git pull
( cd backend  && npm ci && npm run build )
( cd frontend && npm ci && npm run build )   # rebuild needed for NEXT_PUBLIC_* changes
pm2 startOrReload backend/deploy/ecosystem.config.cjs --update-env
```

## 6. Migrating the live box from the Express layout

The live box ran `backend/` as an **Express** API (`ai-spark-api`, :4000) and
`frontend/` as Next.js (`ai-spark-web`, :3000). The new layout keeps the same two
process names, ports and proxy split — only the backend is now a Next.js app:

1. **Back up uploads first:** `tar czf ~/uploads-backup.tgz -C ~/ai-spark/backend uploads`
2. `git pull`. `backend/.env` and `backend/uploads/` are untracked and stay in place
   (the new backend reads the same variables and the same `uploads/` folder).
3. Add to `backend/.env`: `APP_PUBLIC_URL=https://<DOMAIN>` (if missing) — `CORS_ORIGIN`
   is reused as-is. Add `NEXT_PUBLIC_BACKEND_URL=https://<DOMAIN>` to
   `frontend/.env.local` (the old `NEXT_PUBLIC_API_BASE_URL` is no longer used).
4. Rebuild both apps and reload PM2 (step 5), or re-run
   `DOMAIN=<DOMAIN> bash backend/deploy/setup-ec2.sh`.
5. Copy `backend/deploy/apache-ai-spark.conf` to the Apache site (same `/api` → :4000
   split; 520 MB body limit, 15-minute proxy timeout) and
   `sudo apachectl configtest && sudo systemctl reload apache2`.
6. Check `/api/health`, log in, open a lesson with an uploaded file.

---

## Operational notes

- **Logs:** `pm2 logs ai-spark-api` / `pm2 logs ai-spark-web`. Apache: `/var/log/apache2/ai-spark-*.log`; nginx: `/var/log/nginx/`.
- **Uploads:** `backend/uploads/` (or `UPLOAD_DIR`) is NOT in MongoDB — exclude it
  from deploy syncs and back it up.
- **TLS renewal:** certbot installs a systemd timer; auto-renews. Test: `sudo certbot renew --dry-run`.
- **Restart on reboot:** handled by `pm2 save` + `pm2 startup` in the bootstrap.

## Production caveats

1. **Seeding on every boot.** `backend/instrumentation.ts` → `server/bootstrap.ts` re-runs
   `seedDemoUsers` / `seedAnalyticsCohort` / `seedForum` at startup. Seeds are
   idempotent, but the demo passwords are live accounts — set strong `SEED_*` values.
2. **Single instance = single point of failure.** Fine for a demo/MVP; for HA move to
   an ALB + Auto Scaling (and object storage for uploads) later.
3. **Atlas network access.** Don't leave `0.0.0.0/0` open in production — restrict
   to the Elastic IP.

## Troubleshooting

- **`next build` killed / OOM on a 1 GB instance:** add swap, then rebuild:
  `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
- **certbot fails:** DNS A-record must point at the box and ports 80/443 open in
  the security group *before* running it. Fix, then re-run `backend/deploy/setup-ec2.sh`.
- **Login appears to do nothing:** you're on HTTP, not HTTPS — the `Secure` cookie
  is being dropped. Confirm certbot succeeded and you're visiting `https://`.
- **`/api/health` returns 503 / API calls 500:** check `pm2 logs ai-spark-api`. Usually a
  bad `MONGODB_URI` (Atlas user/password, Network Access) or a missing/short
  `JWT_SECRET` (must be ≥32 chars in production).
- **Large uploads fail at ~30 MB:** the proxy config wasn't updated — see step 6.5.
