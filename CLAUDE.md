# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A MOOC / online-learning platform ("ai-spark" / "AI For Everyone") for the Centre of
Excellence in Logistics & Supply Chain Management, Doon University. It is a **two-app
monorepo**:

- **`frontend/`** — Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui ("new-york").
- **`backend/`** — Express 4 + Mongoose 8 (MongoDB) + JWT auth. Pure ESM, run with `tsx`.

> **The app was migrated from TanStack Start → Next.js/Express/MongoDB.** The old
> TanStack app now lives in **`legacy-backup/`** (rollback snapshot — do not edit or
> import from it). Root-level `MIGRATION_PLAN.md`, `TARGET_ARCHITECTURE.md`, and
> `NEXTJS_MIGRATION_STATUS.md` document that migration; `DEPLOY.md` is **stale**
> (Cloudflare/TanStack) — the current deploy guide is **`DEPLOY_AWS.md`**. The
> root `src/` (just `start.ts`) and root config files are legacy leftovers; all
> live code is under `frontend/` and `backend/`.

The data model is **hybrid**:
- **Real, server-side (MongoDB)**: auth/sessions, student registration+approval,
  certificates, analytics, forum, and reviews/ratings.
- **Mock, client-side**: course/lesson/quiz *content* and most session UI state, in
  `frontend/data/mock.ts` + `frontend/context/AppContext.tsx` (course content is
  intentionally static per the migration plan).

## Commands

Each app has its own `package.json` and `node_modules`. Run commands **inside** the
respective directory. Both apps use npm (`package-lock.json`), not Bun (Bun was the
legacy tooling).

```bash
# --- backend/ (Express API, default port 4000) ---
npm install
npm run dev          # tsx watch src/index.ts (needs a running MongoDB — see env)
npm run build        # tsc → dist/  (note: emits extensionless ESM; see PM2 note below)
npm run start        # node dist/index.js
npm run seed         # tsx src/seed/index.ts

# --- frontend/ (Next.js, default port 3000) ---
npm install
npm run dev          # next dev
npm run build        # next build (type-checks; eslint is ignored during build)
npm run start        # next start
npm run lint         # next lint
```

**There is no unit-test framework.** Verification is done with live end-to-end
harnesses in **`backend/verify/*.mts`**, which boot an ephemeral in-memory MongoDB
(`mongodb-memory-server`) + the real Express app and assert against it. Run one with
`tsx`, e.g. from `backend/`:

```bash
npx tsx verify/runtime-check.mts        # broad API checks (auth, registration, RBAC, forum, analytics…)
npx tsx verify/rbac-check.mts           # guardRedirect matrix
npx tsx verify/registration-check.mts   # student registration workflow (approve/reject/ownership)
npx tsx verify/teacher-check.mts        # teacher-management CRUD (/api/admin/teachers)
npx tsx verify/course-cms-check.mts     # Course CMS: course/module/lesson CRUD, ordering, visibility
npx tsx verify/learning-engine-check.mts # catalog visibility, lesson ordering, role-scoped lesson nav
npx tsx verify/assessment-check.mts     # quizzes: CRUD/publish, grading, pass/fail, answer-key hiding
npx tsx verify/progress-check.mts       # sequential locking, module/course completion, persistence
npx tsx verify/certificate-check.mts    # auto-issue, verify, PDF download, revoke, access control

npx tsx verify/reviews-check.mts        # reviews & ratings
npx tsx verify/feature-check.mts        # seed identities / self-registration rules
npx tsx verify/serve.mts                # boot API on :4000 against ephemeral Mongo (manual probing)
```

When you change backend behavior, run the relevant `verify/*.mts` harness — that is
the project's substitute for a test suite.

## Architecture

### Backend: layered Express (route → controller → service → Mongoose model)
Consistent per-feature layering under `backend/src/` — follow it for new features:
- **`routes/*.routes.ts`** — mount handlers; wrap every async handler in
  `asyncHandler(...)` (from `utils/asyncHandler.ts`) so rejections reach the central
  error handler. Apply `authenticate` / `optionalAuthenticate` / `requireRole(...)`
  here.
- **`controllers/*.controller.ts`** — parse/validate input with **zod** (`schema.parse(req.body)`),
  call the service, shape the HTTP response. A thrown `ZodError` becomes a 400 via
  the central handler in `index.ts`.
- **`services/*.service.ts`** — business logic + Mongoose queries. No `req`/`res`.
- **`models/*.ts`** — Mongoose schemas. **Note `User` uses string `_id`s**
  (`usr-<uuid>`, or fixed `u-*` for seeds) so seeded ids line up with the teacher
  directory (`u-teacher`) and analytics cohort (`u-student`) — don't assume ObjectIds.
- Response envelope convention: success → `{ data: ... }`, error → `{ error: { message } }`.
  Routes are all mounted under `/api` (reviews at bare `/api`, others at `/api/<feature>`).
- `index.ts` is the single entry: middleware → route mounts → central error handler →
  `start()` which `connectDb()` then runs idempotent seeds (`seedDemoUsers`,
  `seedAnalyticsCohort`, `seedForum`) before `listen`.

### Auth, RBAC & the shared access module
- **JWT sessions**, not sealed cookies. `signToken`/`verifyToken` (`utils/jwt.ts`)
  issue a 7-day JWT stored in an **`afe_session` httpOnly cookie** (`sameSite=lax`,
  `secure` only in prod). `authenticate` reads the cookie *or* an
  `Authorization: Bearer` header. Passwords use **PBKDF2-HMAC-SHA256 via Web Crypto**
  (`utils/password.ts`) — no native bcrypt/argon2. `authenticate()` in the auth
  service always hashes even for unknown logins (timing-safe).
- **`backend/src/shared/access.ts` and `frontend/lib/access.ts` are kept in sync**
  (identical logic; only header comments differ) and are the single source of truth
  for `Role`, `ROUTE_ACCESS`, `roleHome`, and the pure `guardRedirect` decision.
  **If you change one, change the other.**
- **Two enforcement layers**: (1) `frontend/middleware.ts` is the UX guard — it calls
  `GET /api/auth/me` and applies `guardRedirect` to redirect `/student|/instructor|/admin`
  + `/login|/register`. (2) The Express API is the real authority — every protected
  endpoint enforces `authenticate`/`requireRole`. Don't rely on the middleware for
  security.
- **Roles** (exactly three): `student`, `teacher`, `platform_admin`. Teachers are
  provisioned only by platform admins (`/api/admin/teachers`); they never self-register.
  The teacher-facing surface is **`/instructor/*`** only (there is no `/teacher/*` route
  namespace). **Student approval (FR-01/FR-02)**: new students are
  `registrationStatus: "pending"` and `guardRedirect` funnels all `/student/*` traffic
  to `/student/pending` until their assigned teacher approves them.
- **No School entity**: `schoolName` on registrations/analytics is free-text
  informational data and is the analytics grouping key — there is no `schoolId`.

### Frontend: App Router + Axios (no React Query)
- **App Router** in `frontend/app/` (`page.tsx` per route, `(auth)` route group,
  `[param]` dynamic segments). Root shell is `app/layout.tsx` — mounts `AppProvider`,
  sonner `<Toaster />`, and the global `Footer`.
- **Data fetching is Axios + `useEffect`**, deliberately *not* React Query (the
  provider was intentionally omitted in the migration). The shared instance is
  `frontend/lib/api/axios.ts` (`withCredentials: true` to carry the session cookie);
  per-feature typed wrappers live in `frontend/lib/api/*.ts` (`auth`, `registrations`,
  `analytics`, `forum`, `certificates`, `reviews`). API base URL comes from
  `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:4000/api`).
- **`AppContext` (`useApp()`)** holds two things: (1) real **session identity**
  (`authUser`, `role`, `isAuthenticated`, `logout`) resolved from `GET /api/auth/me`
  via the Axios auth service; and (2) **client-only UI/course-engine state**
  (enrollment, progress, notes, reflections, `assessmentScores`, `timeSpent`, dark
  mode, admin approval queues) backed by `frontend/data/mock.ts`. Note `currentUser`
  (mock course/enrollment identity) is distinct from `authUser` (real session).

### UI conventions
- shadcn/ui ("new-york") in `frontend/components/ui/`. Icons: **lucide-react**. Class
  merge: `cn()` from `frontend/lib/utils.ts`. Toasts: **sonner**. Charts: **recharts**.
  Path alias `@/` → the app root (`frontend/`), configured in `frontend/tsconfig.json`.
- The three surfaces — student, instructor, admin — each have a sidebar
  (`StudentSidebar`/`InstructorSidebar`/`AdminSidebar`) and their own `app/<surface>/*`
  routes.
- `next.config.ts` sets `eslint.ignoreDuringBuilds: true` **on purpose** — the frontend
  sits inside the legacy repo whose root eslint flat config gets picked up by ESLint's
  upward search and fails `next build` on formatting rules. Type-safety is still
  enforced by `tsc`/`next build`. Don't remove this without fixing the root cause.

### Environment variables
- **Backend** (`backend/.env`, read at module scope in `config/env.ts` — safe under
  Node): `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET` (≥32 chars; **required in
  production**, dev has an insecure fallback), `CORS_ORIGIN`. Seed passwords overridable
  via `SEED_STUDENT_PASSWORD` / `SEED_TEACHER_PASSWORD` / `SEED_PLATFORM_ADMIN_PASSWORD`.
- **Frontend**: only `NEXT_PUBLIC_API_BASE_URL` (public — no secrets client-side).

### Demo accounts (seeded, idempotent)
`student@afe.edu` / `Student@123` (approved) · `teacher@afe.edu` / `Teacher@123` ·
platform admin username **`Moocs@admin`** (email `admin@afe.edu`) / `Admin@123`.
Instructor/admin display names are all "Dr Sudhanshu Joshi".

## Deployment

See **`DEPLOY_AWS.md`**. Single EC2 box runs both apps under **PM2**
(`deploy/ecosystem.config.cjs`) behind **nginx** as a single-origin reverse proxy
(`deploy/nginx.conf`): `/` → Next.js :3000, `/api/*` → Express :4000. MongoDB is on
Atlas. Single-origin + Let's Encrypt TLS is **required** — the `secure` `afe_session`
cookie is dropped over plain HTTP and login silently fails. The backend runs from **TS
source via `tsx`** under PM2 (not `dist/`), because `tsc` emits extensionless ESM
imports that Node's native loader rejects.
