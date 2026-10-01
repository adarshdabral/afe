# Deploying ai-spark — frontend on Vercel, backend on Render

The repo holds two independent Next.js apps:

| Folder | What | Host | Port (local) |
|---|---|---|---|
| `frontend/` | UI (pages, components) | **Vercel** | 3000 |
| `backend/` | API (`app/api/**` route handlers, MongoDB, uploads, certificates) | **Render** | 4000 |

```
Browser ──► https://<app>.vercel.app            (frontend, Vercel)
              │  /api/*  ── rewrite (server-side proxy) ──►  https://<api>.onrender.com/api/*
              │  large uploads + uploaded media ───────────►  https://<api>.onrender.com  (direct)
                                                               │
                                                               ├─► MongoDB Atlas
                                                               └─► Persistent Disk (uploads)
```

**Why the `/api` rewrite:** the login cookie (`afe_session`, httpOnly) must be
first-party. If the browser called `*.onrender.com` directly, it would be a
third-party cookie that Safari (and others) block, and login would silently fail.
With the rewrite the browser only ever talks to the Vercel domain.

**Why uploads go direct:** big bodies (videos up to 500 MB) shouldn't go through the
proxy. The admin UI gets a 15-minute, upload-only token over `/api`, then posts the
file straight to Render with `Authorization: Bearer <token>`. CORS on the backend
allows only `CORS_ORIGIN`.

---

## 1. MongoDB Atlas

1. Create a cluster, add a **database user** (Security → Database Access).
2. **Network Access** → allow Render's outbound IPs, or `0.0.0.0/0` (Render's IPs
   are shared/dynamic on most plans).
3. Copy the SRV string and add the db name: `…mongodb.net/ai-spark?retryWrites=true&w=majority`.

## 2. Backend on Render

1. Render → **New → Blueprint** → select this repo. It reads `render.yaml`
   (`rootDir: backend`, `npm ci && npm run build`, `npm start`, health check
   `/api/health`, a 10 GB **Persistent Disk** at `/var/data` for uploads).
2. Fill in the prompted environment variables:
   - `MONGODB_URI` — the Atlas string.
   - `APP_PUBLIC_URL` and `CORS_ORIGIN` — your **frontend** URL, e.g.
     `https://ai-spark.vercel.app` (no trailing slash). If you don't know it yet,
     deploy the frontend first, then set these and redeploy.
   - `SEED_*_PASSWORD` — strong passwords for the demo accounts (they are live logins).
   - `JWT_SECRET` is generated automatically.
3. After the first deploy, seed the course once from the service **Shell**:
   `npm run seed` (destructive to any other course — see `CLAUDE.md`).
4. Check `https://<api>.onrender.com/api/health` → `{"data":{"ok":true}}`.

> **Uploads need a paid instance.** Render's normal filesystem is wiped on every
> deploy and restart; Persistent Disks require a paid instance type (the Blueprint
> uses `starter`). On the free plan, remove `disk` and `UPLOAD_DIR` from
> `render.yaml`, and accept that uploaded files will disappear (use YouTube/Vimeo or
> external URLs for lesson media instead). Free instances also sleep after ~15
> minutes idle; the first request then takes up to a minute.

## 3. Frontend on Vercel

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory: `frontend`** (framework auto-detected as Next.js).
3. Environment variable: `NEXT_PUBLIC_BACKEND_URL=https://<api>.onrender.com`
   (no trailing slash). It is read at **build time** — redeploy after changing it.
4. Deploy, then put the resulting URL into the backend's `APP_PUBLIC_URL` and
   `CORS_ORIGIN` (Render → Environment) and redeploy the backend.

`frontend/vercel.json` turns off Vercel's CDN caching for the `/api/*` rewrite (API
responses are per-user; the backend also sends `Cache-Control: no-store`).

## 4. Verify

- Open the Vercel URL → the AI for Everyone landing page renders with the curriculum.
- Log in as `Moocs@admin` (your `SEED_PLATFORM_ADMIN_PASSWORD`), open a lesson in the
  CMS, upload a PDF and a small MP4 → both preview and play.
- Log in as a student → the course and progress load; complete a lesson.

## Local development

```bash
cd backend  && cp .env.example .env   # fill MONGODB_URI, JWT_SECRET
npm install && npm run dev             # API on http://localhost:4000
npm run seed                           # once: demo users + the AI for Everyone course

cd frontend && cp .env.example .env.local   # NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
npm install && npm run dev             # UI on http://localhost:3000
```

## Troubleshooting

- **Login does nothing / logged out on refresh:** the browser must be calling the
  Vercel domain's `/api`, never `onrender.com` directly — check
  `NEXT_PUBLIC_BACKEND_URL` was set *before* the Vercel build.
- **Upload fails with a CORS error:** the backend's `CORS_ORIGIN` must exactly match
  the frontend origin (scheme + host, no trailing slash). Preview deployments have
  their own URLs — add them comma-separated if you upload from previews.
- **Uploaded files vanish after a deploy:** no Persistent Disk (free plan) or
  `UPLOAD_DIR` not pointing inside the disk mount.
- **First page load is slow / redirected to login once:** the free Render instance
  was asleep (middleware gives up after 10 s). Use a paid instance or a keep-alive ping.
- **Certificate QR codes point to the wrong site:** set `APP_PUBLIC_URL` on the backend
  to the frontend URL.

## Self-hosting instead

To run both apps on a single server (the current EC2 box with Apache), see
**`DEPLOY_AWS.md`** and `backend/deploy/`.
