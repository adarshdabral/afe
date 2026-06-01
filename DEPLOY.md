# Deploying ai-spark (GitHub → Cloudflare)

This app is **TanStack Start + Nitro** with the `cloudflare-module` preset
(`@lovable.dev/vite-tanstack-config`, `deployConfig: true`). Build output:
`dist/client` (static assets) + `dist/server/server.js` (the Worker entry).

> ⚠️ **Before deploying — read "Known blockers" at the bottom.** As-is this is a
> *throwaway demo*: all server state is in-memory and resets on every redeploy /
> isolate eviction. Do not treat it as production until Phase 0 (database) is done.

---

## Required configuration (both paths)

| Name | Value | Why |
| --- | --- | --- |
| `SESSION_SECRET` | a random string ≥ 32 chars | The app **throws on boot in production** without it (`session.server.ts`). Generate: `openssl rand -base64 48`. |
| `NODE_ENV` | `production` | Enables secure cookies + the secret check. |
| compat flag | `nodejs_compat` | Worker uses Node-compatible APIs. |

Optionally override the seed accounts via `SEED_STUDENT_PASSWORD`,
`SEED_TEACHER_PASSWORD`, `SEED_SCHOOL_ADMIN_PASSWORD`, `SEED_PLATFORM_ADMIN_PASSWORD`
(the defaults are weak demo values — change them).

---

## Path A — Cloudflare Workers Builds (recommended, dashboard)

No secrets stored in GitHub; Cloudflare builds the Worker in its own environment
(which emits the Nitro deploy config correctly).

1. Cloudflare dashboard → **Workers & Pages → Create → Connect to Git** → pick
   `adarshdabral/ai-spark`.
2. **Build command:** `bun run build`  ·  **Deploy command:** `npx wrangler deploy`
   ·  **Root directory:** `/`.
3. **Variables & Secrets:** add `SESSION_SECRET` (secret) and `NODE_ENV=production`.
4. Set the **production branch** to `main`. Pushes to `main` then build + deploy.

## Path B — GitHub Actions (alternative)

A starter workflow is committed at `.github/workflows/deploy.yml` (manual trigger
by default). To use it, add these repo **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit)
- `CLOUDFLARE_ACCOUNT_ID`
- `SESSION_SECRET`

Then run it from the **Actions** tab (or flip the trigger to `push: main`). Note:
confirm the `wrangler deploy` invocation matches the Nitro output on your first run —
Path A avoids this by using Cloudflare's managed build.

---

## Known blockers (from the production audit)

1. **Ephemeral data (CRITICAL for prod).** Auth users, registrations, forum,
   certificates, and analytics are in-memory `Map`s — per-isolate and wiped on
   redeploy. Sessions/registrations/certificates will not persist or shard.
   Fix: move the `*.server.ts` stores to PostgreSQL (SRS §6/§7) — they were built
   as DB seams. Until then, deploy only as a demo.
2. **Secrets.** Set `SESSION_SECRET`; rotate the weak seed passwords.
3. **Supply chain.** A typosquat dependency `wrnagler` was found and removed from
   `package.json`. Reinstall cleanly before deploying:
   `rm -rf node_modules bun.lock && bun install`, and audit the machine since its
   install scripts may have run.
4. **Confidential doc.** `SRS.pdf` is git-ignored so it is not published — keep it
   out of the repo.
