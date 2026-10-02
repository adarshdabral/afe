# Deploying ai-spark — frontend on Vercel, backend on Render

The repo holds two independent Next.js apps:

| Folder | What | Host | Port (local) |
|---|---|---|---|
| `frontend/` | UI (pages, components) | **Vercel** | 3000 |
| `backend/` | API (`app/api/**` route handlers, MongoDB, uploads, certificates) | **Render** | 4000 |

```
Browser ──► https://<app>.vercel.app            (frontend, Vercel)
              │  /api/*  ── rewrite (server-side proxy) ──►  https://<api>.onrender.com/api/*
              │                                                │
              │                                                ├─► MongoDB Atlas
              │                                                ├─► Workers AI (text-to-speech)
              │                                                └─► R2 (writes generated audio)
              │  lesson files: PUT with presigned URL ──────►  Cloudflare R2 bucket
              └  video / audio / PDF / subtitles: GET ──────►  R2 public URL (r2.dev / custom domain)
```

**Why the `/api` rewrite:** the login cookie (`afe_session`, httpOnly) must be
first-party. If the browser called `*.onrender.com` directly, it would be a
third-party cookie that Safari (and others) block, and login would silently fail.
With the rewrite the browser only ever talks to the Vercel domain.

**Why files go straight to R2:** lesson media (videos up to 500 MB, audio, decks,
subtitles) never passes through Vercel or Render. The admin UI asks the backend for
a presigned PUT URL (`POST /api/admin/uploads/presign`, valid 1 hour, bound to the
file's type and size), uploads directly to the R2 bucket, and saves the public URL
on the lesson. Without R2 configured, the backend falls back to storing files on its
own disk (upload token + `Authorization: Bearer`, CORS limited to `CORS_ORIGIN`).

---

## 1. MongoDB Atlas

1. Create a cluster, add a **database user** (Security → Database Access).
2. **Network Access** → allow Render's outbound IPs, or `0.0.0.0/0` (Render's IPs
   are shared/dynamic on most plans).
3. Copy the SRV string and add the db name: `…mongodb.net/ai-spark?retryWrites=true&w=majority`.

## 2. Cloudflare R2 + Workers AI

**R2 (lesson media):**
1. Cloudflare dashboard → **R2** → create a bucket (e.g. `ai-spark-media`).
2. Bucket → **Settings → Public access**: enable the **r2.dev subdomain** (fine for
   testing; rate-limited) or connect a **custom domain** (recommended for production).
   Note the public URL, e.g. `https://pub-xxxx.r2.dev` → this is `R2_PUBLIC_URL`.
3. R2 → **Manage API tokens** → create a token with **Object Read & Write** on that
   bucket. Note the **Access Key ID** and **Secret Access Key**, and your **Account ID**.
4. **CORS** (required — the browser uploads with PUT and loads captions): after setting
   the backend env vars, run once from `backend/`: `npm run r2:cors`
   (or paste this in Bucket → Settings → CORS policy):
   ```json
   [
     { "AllowedOrigins": ["https://<app>.vercel.app"], "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 },
     { "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"], "MaxAgeSeconds": 86400 }
   ]
   ```

**Workers AI (text-to-speech for lesson audio):**
1. Cloudflare dashboard → **My Profile → API Tokens → Create token** with
   **Workers AI – Read** and **Workers AI – Edit** → this is `CLOUDFLARE_AI_TOKEN`.
2. Default model: Deepgram **Aura-2** (`@cf/deepgram/aura-2-en`) with the male voice
   **orion**; admins can pick another voice (male/female) per narration. Output is MP3
   (~360 KB per minute). Costs about $0.03 per 1,000 characters on your Cloudflare account.
   Set `TTS_VOICE` to change the default, or `TTS_MODEL=@cf/myshell-ai/melotts` for a
   cheaper single-voice model (WAV output, larger files). Learners hear narration at
   0.9× by default and can change the speed in the player.

## 3. Backend on Render

1. Render → **New → Blueprint** → select this repo. It reads `render.yaml`
   (`rootDir: backend`, `npm ci && npm run build`, `npm start`, health check
   `/api/health`, a 10 GB **Persistent Disk** at `/var/data` for uploads).
2. Fill in the prompted environment variables:
   - `MONGODB_URI` — the Atlas string.
   - `APP_PUBLIC_URL` and `CORS_ORIGIN` — your **frontend** URL, e.g.
     `https://ai-spark.vercel.app` (no trailing slash). If you don't know it yet,
     deploy the frontend first, then set these and redeploy.
   - `SEED_*_PASSWORD` — strong passwords for the demo accounts (they are live logins).
     Leave blank to use the defaults (`Student@123` / `Teacher@123` / `Admin@123`).
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
     `R2_PUBLIC_URL` (from step 2) and `CLOUDFLARE_AI_TOKEN`.
   - `JWT_SECRET` is generated automatically.
3. After the first deploy, seed the course once from the service **Shell**:
   `npm run seed` (destructive to any other course — see `CLAUDE.md`; use
   `npm run seed:flagship` to keep existing courses).
4. Check `https://<api>.onrender.com/api/health` → `{"data":{"ok":true}}`.
5. Upgrading an existing database?
   - **Back it up first** (Atlas → your cluster → Backup/Snapshots, or
     `mongodump --uri "$MONGODB_URI"`). The first start of this version runs a
     one-time, automatic migration to Course → Module → Lesson → Topic: existing
     content "lessons" become **topics** (same ids, so student progress is kept),
     each module gets one container lesson, progress/analytics fields are renamed,
     and every course gets its Introduction / Overview / Meet the Instructor sections.
     It is safe to re-run (`server/migrations/lessons-to-topics.ts`).
   - Then run `npm run backfill:objectives` once (Shell) to give the course's
     existing modules their learning objectives without rebuilding the course.

> **With R2 configured, uploads don't touch Render's disk.** The Persistent Disk in
> `render.yaml` only matters for the no-R2 fallback (Render's normal filesystem is
> wiped on every deploy and restart, and disks need a paid instance). Once R2 is live
> you can drop the disk and even use the free plan — but free instances sleep after
> ~15 minutes idle, and the first request then takes up to a minute.

## 4. Frontend on Vercel

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory: `frontend`** (framework auto-detected as Next.js).
3. Environment variable: `NEXT_PUBLIC_BACKEND_URL=https://<api>.onrender.com`
   (no trailing slash). It is read at **build time** — redeploy after changing it.
4. Deploy, then put the resulting URL into the backend's `APP_PUBLIC_URL` and
   `CORS_ORIGIN` (Render → Environment) and redeploy the backend.

`frontend/vercel.json` turns off Vercel's CDN caching for the `/api/*` rewrite (API
responses are per-user; the backend also sends `Cache-Control: no-store`).

## 5. Verify

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
- **Upload fails with "Network error" / a CORS error:** the R2 bucket's CORS policy (or,
  without R2, the backend's `CORS_ORIGIN`) must allow the exact frontend origin (scheme +
  host, no trailing slash). Re-run `npm run r2:cors` after changing `CORS_ORIGIN`.
  Preview deployments have their own URLs — add them comma-separated.
- **Upload fails with "signature mismatch" (403 from R2):** wrong R2 keys/bucket/account,
  or the system clock is off. Check the `R2_*` values.
- **Uploads over 10 MB failed** (before this release): a backend middleware truncated
  request bodies at 10 MB — fixed; uploads now go straight to R2.
- **Subtitles don't show:** the video must be an uploaded/direct file (YouTube/Vimeo use
  their own captions), and the R2 CORS policy must allow GET.
- **"Generate from text" is disabled:** set `CLOUDFLARE_AI_TOKEN` (and the account id)
  on the backend.
- **Uploaded files vanish after a deploy:** no Persistent Disk (free plan) or
  `UPLOAD_DIR` not pointing inside the disk mount.
- **First page load is slow / redirected to login once:** the free Render instance
  was asleep (middleware gives up after 10 s). Use a paid instance or a keep-alive ping.
- **Certificate QR codes point to the wrong site:** set `APP_PUBLIC_URL` on the backend
  to the frontend URL.

## Self-hosting instead

To run both apps on a single server (the current EC2 box with Apache), see
**`DEPLOY_AWS.md`** and `backend/deploy/`.
