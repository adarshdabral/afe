# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A MOOC / online-learning platform ("AI Spark" presenting the course "AI for
Everyone") for the Centre of Excellence in Logistics & Supply Chain Management, Doon
University. The repo has exactly **two apps, both Next.js 15**:

- **`frontend/`** — the UI (App Router, React 19, Tailwind v4, shadcn/ui "new-york").
  Deployed on **Vercel**. Has no database access; calls the backend.
- **`backend/`** — an **API-only Next.js app**: route handlers under
  `backend/app/api/**`, backed by `backend/server/` (controllers → services →
  Mongoose 8 models, JWT auth, uploads, certificate PDFs). Deployed on **Render**
  (`render.yaml`). There is no Express any more.

For a product-level list of what the platform does (and how it is operated), see
**`FEATURES.md`**.

> **History:** TanStack Start → Next.js + Express/MongoDB → Next.js frontend +
> Next.js backend. The legacy TanStack snapshot (`legacy-backup/`) and root `src/`
> were removed (recoverable from git history). **Stale docs:** `PROJECT_MEMORY.md`,
> `MIGRATION_PLAN.md`, `TARGET_ARCHITECTURE.md`, `NEXTJS_MIGRATION_STATUS.md`
> describe older states — don't follow them. Deploy guides: **`DEPLOY.md`**
> (Vercel + Render, primary) and **`DEPLOY_AWS.md`** (self-hosted, one EC2 box).

**All domain data is server-side (MongoDB).** Auth/sessions, student
registration+approval, the Course CMS (courses → modules → lessons), assessments &
attempts, per-student progress, certificates, analytics, forum, reviews/ratings, and
uploaded lesson files are all real and owned by `backend/`. There is **no mock course
content** any more (`frontend/data/` is empty). The only client-only state is the
dark-mode preference.

## Commands

Each app has its own `package.json`/`node_modules` (npm, not Bun). Run commands
**inside** the app's directory. Run both for local development.

```bash
# --- backend/ (API, http://localhost:4000) — config in backend/.env ---
npm install
npm run dev          # next dev -p 4000 (needs MONGODB_URI)
npm run build        # next build
npm run start        # next start (respects $PORT — Render sets it)
npm run typecheck    # tsc --noEmit
npm run seed         # demo users + standardize content to the single "AI for Everyone" course

# --- frontend/ (UI, http://localhost:3000) — config in frontend/.env.local ---
npm install
npm run dev          # next dev
npm run build        # next build (type-checks; eslint is ignored during build)
npm run start        # next start
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
```

`npm run seed` (`backend/server/seed/course.seed.ts`) is **destructive to other courses**: it
soft-deletes every course except "AI for Everyone" and (re)builds that course's 12
modules, lessons and assessments. It is intentionally *not* run on server startup.

**There is no unit-test framework.** Verification is done with live end-to-end
harnesses in **`backend/verify/*.mts`**, which boot an ephemeral in-memory MongoDB
(`mongodb-memory-server`) + the **real backend app in-process** (`verify/_server.mts`:
production build, rebuilt automatically when sources are newer than `.next/`) and
assert against it over HTTP. Running in-process lets harnesses flip env flags (e.g.
`REQUIRE_TEACHER_APPROVAL`) at runtime. `middleware-e2e` additionally builds and
starts the **frontend** (`verify/_frontend.mts`) wired to that backend. Run one with
`tsx` from `backend/`:

```bash
npx tsx verify/runtime-check.mts         # broad API checks (auth, registration, RBAC, forum, analytics…)
npx tsx verify/auth-check.mts            # login by email/username, cookie, /me, approval-mode toggle
npx tsx verify/rbac-check.mts            # guardRedirect matrix
npx tsx verify/rbac-access-check.mts     # route guard + live API 401/403 matrix per role
npx tsx verify/middleware-e2e.mts        # both apps: SSR landing, /api rewrite, login cookie, middleware redirects
npx tsx verify/registration-check.mts    # student registration workflow (approve/reject/ownership)
npx tsx verify/teacher-check.mts         # teacher-management CRUD (/api/admin/teachers)
npx tsx verify/course-cms-check.mts      # Course CMS: course/module/lesson CRUD, ordering, visibility
npx tsx verify/course-content-check.mts  # seed: AI for Everyone is the only course, 12 modules, quiz mix
npx tsx verify/upload-check.mts          # uploads: RBAC, 415/413/400, Range/206, upload tokens, CORS, lessons
npx tsx verify/learning-engine-check.mts # catalog visibility, lesson ordering, role-scoped lesson nav
npx tsx verify/assessment-check.mts      # quizzes: CRUD/publish, grading, pass/fail, answer-key hiding
npx tsx verify/progress-check.mts        # sequential locking, module/course completion, persistence
npx tsx verify/certificate-check.mts     # auto-issue, verify, PDF download, revoke, access control
npx tsx verify/reviews-check.mts         # reviews & ratings
npx tsx verify/feature-check.mts         # seed identities / self-registration rules
npx tsx verify/e2e-student-journey.mts   # register → learn → quiz → complete → certificate → verify
npx tsx verify/e2e-admin-journey.mts     # teachers → courses/modules/lessons → assessments → certs
npx tsx verify/serve.mts                 # backend on :3100 + ephemeral Mongo + seeded course (manual probing)
```

When you change API/server behavior, run the relevant `verify/*.mts` harness — that is
the project's substitute for a test suite. Add a new harness for a new feature.

## Architecture

### Backend: Route Handler → controller → service → Mongoose model
Consistent per-feature layering under `backend/` — follow it for new features:
- **`app/api/**/route.ts`** — one file per path; each exported method is
  `handle(controller, options)` from **`server/http/handle.ts`**, e.g.
  `export const GET = handle(course.getTree, ADMIN);`. Options: `ANY_USER`
  (authenticate → 401), `OPTIONAL_USER`, `ADMIN` / `STUDENT` / `STAFF` / `roles(...)`
  (→ 403), `upload: DOCUMENT_UPLOAD | VIDEO_UPLOAD` (multipart), `params` (rename a
  dynamic segment, e.g. reviews reuse `courses/[slug]` as `courseId`). `handle()`
  also awaits `ensureServerReady()` (DB + startup seeds), parses JSON (bad JSON → 400),
  and is the **central error handler**: `ZodError` → 400; any error carrying a
  numeric `statusCode` (e.g. `HttpError` in `server/http/errors.ts`) → that status;
  else 500.
- **`server/controllers/*.controller.ts`** — parse/validate input with **zod**
  (`schema.parse(req.body)`), call the service, shape the HTTP response. They use
  the small Express-like `ApiRequest`/`ApiResponse` contract in `server/http/types.ts`
  (`req.body/params/query/user/file`, `res.status().json()`, `cookie`, `send`…).
- **`server/services/*.service.ts`** — business logic + Mongoose queries. No `req`/`res`.
  (The frontend never imports backend code — it talks to the API over HTTP.)
- **`server/models/*.ts`** — Mongoose schemas registered via `defineModel()` (safe
  under dev hot-reload), each with a `to<Entity>()` mapper producing a plain `*View`
  object (string `id`, ISO timestamps) — return views, never raw docs.
  **`User` uses string `_id`s** (`usr-<uuid>`, or fixed `u-*` for seeds) so seeded ids
  line up with the teacher directory (`u-teacher`) and analytics cohort
  (`u-student`) — don't assume ObjectIds. Cross-entity references (`courseId`,
  `moduleId`, `studentId`…) are stored as strings.
- **Static content** for the seeded course lives in `server/data/` (`curriculum.ts`,
  `assessments.ts`) and `server/seed/ai-course.data.ts`.
- Response envelope convention: success → `{ data: ... }`, error → `{ error: { message } }`
  (unknown `/api/*` paths → JSON 404 via `app/api/[...notFound]`).
- **Startup**: `instrumentation.ts` → `server/bootstrap.ts` `ensureServerReady()`
  connects (`server/config/db.ts`, cached on `globalThis`) and runs the idempotent
  seeds (`seedDemoUsers`, `seedAnalyticsCohort`, `seedForum`) once per process.
  `/api/health` reports DB readiness (503 if down).
- `backend/middleware.ts` only adds **CORS** (origins from `CORS_ORIGIN`, no
  credentials) to the upload/media paths the frontend calls directly.
- Every JSON API response carries `Cache-Control: no-store` (it's proxied through a CDN).

### API surface (`backend/app/api/**`)
| Path | Who | Purpose |
|---|---|---|
| `/api/auth` | public / any | login (email **or** username), register, `me`, logout |
| `/api/registrations` | public + teacher/admin | teacher directory, self-registration, approval queue, decide |
| `/api/admin/teachers` | platform_admin | teacher CRUD, activate/deactivate, reset password |
| `/api/admin/courses` | platform_admin | course/module/lesson CRUD, reorder, publish/unpublish/archive |
| `/api/admin/assessments` | platform_admin | assessment + question CRUD, reorder, publish |
| `/api/admin/uploads` | platform_admin | `/token` (15-min upload-only token); multipart upload (`file` field) of lesson materials; `/video` for videos |
| `/api/uploads/<file>` | public, read-only | `app/api/uploads/[...path]` streams from `UPLOAD_DIR` (Range/206) |
| `/api/courses` | public (optional auth) | published catalog, course tree by slug, lesson by id |
| `/api/assessments` | auth; attempts = student | answer-key-stripped quiz, submit attempt, my attempts |
| `/api/progress` | student | per-course progress, complete lesson, visit, time tracking |
| `/api/certificates` | public verify; student; admin | verify, mine, claim, PDF download, list/revoke |
| `/api/analytics` | student push; teacher/admin read | progress snapshot sync, teacher/school/platform aggregates |
| `/api/forum` | auth; moderation = teacher/admin | threads, replies, moderate thread/post |
| `/api/courses/:id/reviews`, `/api/reviews/:id` | public read; auth write | reviews + rating aggregate |

### Domain rules worth knowing
- **Course hierarchy**: Course → Module → Lesson, each sequenced by `order`; lessons
  denormalize `courseId`. Course `status` is `draft | published | archived`; courses
  are **soft-deleted** (`deletedAt`). `slug` is unique and the public lookup key.
  Students only ever see published content (role-scoped in `course.service.ts`).
- **Lesson content types** (`LESSON_CONTENT_TYPES`, duplicated in
  `backend/server/models/Lesson.ts` and `frontend/lib/api/courses.ts` — keep in sync):
  `video`, `pdf`, `presentation`, `rich_text`, `infographic`, `case_study`,
  `reflection`, `activity`. Rendered by `frontend/components/learn/LessonRenderer.tsx`,
  edited by `frontend/components/course/LessonEditor.tsx`.
- **Uploads** (`backend/server/utils/storage.ts`): multipart bodies are **streamed to
  disk with busboy** (never buffered — videos are large) into `UPLOAD_DIR` (default
  `backend/uploads/`, git-ignored — **must persist across deploys**; on Render a
  Persistent Disk), random
  filenames, single `file` field. Documents: PDF/PPT/PPTX/PNG/JPG/GIF/WEBP/SVG
  (ext **and** MIME), 25 MB → `POST /api/admin/uploads`, URL stored as a lesson's
  `documentUrl`. **Lesson videos**: MP4/M4V/WebM/MOV, `UPLOAD_VIDEO_MAX_BYTES`
  (500 MB) → `POST /api/admin/uploads/video`, URL stored as `videoUrl`. Wrong type →
  415, too large → 413 (partial file deleted), no file → 400. **The browser uploads
  straight to the backend** (`frontend/lib/api/uploads.ts`): it fetches an
  upload-scoped JWT from `POST /api/admin/uploads/token` (via the `/api` proxy), then
  posts to `NEXT_PUBLIC_BACKEND_URL` with `Authorization: Bearer`. `handle()` rejects
  upload-scoped tokens on every non-upload endpoint. Stored URLs stay root-relative
  (`/api/uploads/…`); `resolveUploadUrl()` points them at the backend origin.
- **Assessments**: one per module. Question types are `mcq | reflection | scenario`
  (True/False is modelled as a two-option `mcq`). MCQ is auto-graded; open-ended
  (reflection/scenario) earns full marks for a non-empty answer. Pass = % ≥
  `passingScore`. The student fetch strips answer keys.
- **Progress** (`progress.service.ts`): one doc per (student, course). Enforces
  **sequential locking** (lesson N requires N-1), derives module/course completion
  and `certificateEligible`, and **auto-issues the certificate** when eligible.
- **Certificates**: idempotent per (student, course), ids `AFE-YYYY-XXXXXXXX`,
  branded PDF via `pdf-lib` with a QR code pointing at `/certificate/verify/<id>`
  (origin from `APP_PUBLIC_URL`; `CORS_ORIGIN` is a legacy fallback). Admins can revoke.
- **Reviews** recompute a per-course `CourseRating` aggregate after every mutation.

### Auth, RBAC & the shared access module
- **JWT sessions**, not sealed cookies. `signToken`/`verifyToken` (`backend/server/utils/jwt.ts`)
  issue a 7-day JWT stored in an **`afe_session` httpOnly cookie** (`sameSite=lax`,
  `secure` only in prod). `handle()` reads the cookie *or* an
  `Authorization: Bearer` header. Passwords use **PBKDF2-HMAC-SHA256 via Web Crypto**
  (`backend/server/utils/password.ts`) — no native bcrypt/argon2. `authenticate()` in the auth
  service always hashes even for unknown logins (timing-safe).
- **`frontend/lib/access.ts` and `backend/server/shared/access.ts` are kept in sync**
  (identical logic; only header comments differ) and are the single source of truth
  for `Role`, `ROUTE_ACCESS`, `roleHome`, and the pure `guardRedirect` decision.
  **If you change one, change the other** (`verify/rbac-check.mts` exercises it).
  Guarded prefixes: `/student` (student), `/learn` (all roles), `/instructor`
  (teacher + admin), `/admin` (platform_admin).
- **Two enforcement layers**: (1) `frontend/middleware.ts` is the UX guard — it calls
  the backend's `GET /api/auth/me` server-to-server (`NEXT_PUBLIC_BACKEND_URL`,
  forwarding the cookie, 10 s timeout) and applies `guardRedirect`. (2) The backend
  route handlers are the real authority — every protected endpoint enforces
  auth/roles via `handle()`. Don't rely on the middleware for security.
- **Roles** (exactly three): `student`, `teacher`, `platform_admin`. Teachers are
  provisioned only by platform admins (`/api/admin/teachers`, which returns a
  one-time temporary password); they never self-register. The teacher-facing surface
  is **`/instructor/*`** only (there is no `/teacher/*` route namespace).
- **Student approval (FR-01/FR-02) is optional** — gated by `REQUIRE_TEACHER_APPROVAL`
  (default **off**: self-registered students are approved immediately). When on, new
  students are `registrationStatus: "pending"`, `guardRedirect` funnels `/student/*`
  to `/student/pending`, and their chosen teacher (or a platform admin) approves.
  Teachers only see/decide requests assigned to them.
- **No School entity**: `schoolName` on registrations/analytics is free-text
  informational data and is the analytics grouping key — there is no `schoolId`.

### Frontend: App Router + Axios (no React Query)
- **App Router** in `frontend/app/` (`page.tsx` per route, `(auth)` route group,
  `[param]` dynamic segments). Root shell is `app/layout.tsx` — mounts `AppProvider`,
  sonner `<Toaster />`, and the global `Footer`.
- **Talking to the backend**: the browser always calls same-origin **`/api/*`**;
  `frontend/next.config.ts` **rewrites** it to `NEXT_PUBLIC_BACKEND_URL/api/*`. This
  keeps the httpOnly `afe_session` cookie first-party on the frontend domain (a
  cookie on `*.onrender.com` would be third-party and blocked). `frontend/vercel.json`
  disables Vercel CDN caching for `/api/*`. `NEXT_PUBLIC_BACKEND_URL` (`lib/backend.ts`)
  is inlined at **build** time. Exceptions that hit the backend origin directly:
  middleware/SSR fetches, large uploads, and uploaded media.
- **Data fetching is Axios + `useEffect`**, deliberately *not* React Query. The shared
  instance is `frontend/lib/api/axios.ts` (`baseURL: "/api"`, `withCredentials: true`);
  per-feature typed wrappers live in `frontend/lib/api/*.ts` (`auth`, `registrations`,
  `teachers`, `courses`, `assessments`, `progress`, `uploads`, `analytics`, `forum`,
  `certificates`, `reviews`).
- **`AppContext` (`useApp()`)** holds only the **session identity** (`authUser`,
  `role`, `isAuthenticated`, `loadingUser`, `setSession`, `refresh`, `logout`) and
  dark mode. After login/register, call **`setSession(user)`** before navigating so
  the role is known without a refresh. Role-gated pages must check `loadingUser`
  before rendering an "access denied" state (`if (!loadingUser && !isPlatform)`), or
  they flash/deny during session load.
- **`LearningContext`** owns the active course's learning state (completed lessons,
  current lesson, progress) backed by the progress API.
- **Single-course product**: public pages present one flagship course ("AI for
  Everyone", `FLAGSHIP_SLUG` in `frontend/lib/course.ts`, mirrors
  `AI_COURSE_META.slug` in `backend/server/seed/ai-course.data.ts`). `/` and
  `/courses/[slug]` are dynamic server components that fetch the course outline from
  the backend (`lib/server/course.ts`, lesson bodies stripped; client-side retry if
  the backend is asleep) and render `components/course-landing/*`; `/courses` redirects to the
  flagship. Platform brand is "AI Spark"; the course is "AI for Everyone".
- Route map: public `/`, `/courses` (redirect), `/courses/[slug]`, `/certificate/verify{,/[id]}`;
  auth `/login`, `/register`, `/forgot-password` (UI only — no reset backend);
  learner `/learn/[slug]{,/module/[moduleId],/lesson/[lessonId],/assessment/[assessmentId]}`;
  `/student/{dashboard,certificates,forum,pending}`;
  `/instructor/{dashboard,approvals,analytics,forum}`;
  `/admin/{dashboard,courses/**,teachers/**,certificates,analytics}`.

### UI conventions
- shadcn/ui ("new-york") in `frontend/components/ui/`. Icons: **lucide-react**. Class
  merge: `cn()` from `frontend/lib/utils.ts`. Toasts: **sonner**. Charts: **recharts**.
  Path alias `@/` → the app root (`frontend/`), configured in `frontend/tsconfig.json`.
- Accent is violet-600; cards `bg-card rounded-3xl border border-border shadow-soft`.
- The three surfaces — student, instructor, admin — each have a sidebar
  (`StudentSidebar`/`InstructorSidebar`/`AdminSidebar`). CMS building blocks live in
  `components/course/` (`LessonEditor`, `AssessmentBuilder`, `Reorderable`,
  `RichContentEditor`); learner views in `components/learn/`.
- `next.config.ts` sets `eslint.ignoreDuringBuilds: true` **on purpose** — the app
  sits inside the legacy repo whose root eslint flat config gets picked up by ESLint's
  upward search and fails `next build` on formatting rules. Type-safety is still
  enforced by `tsc`/`next build`. Don't remove this without fixing the root cause.

### Environment variables
- **Backend** (`backend/.env` locally — template `backend/.env.example`; on Render the
  service's Environment, see `render.yaml`): `MONGODB_URI`, `JWT_SECRET` (≥32 chars;
  **required in production** — checked lazily at startup so `next build` doesn't need
  it; dev has an insecure fallback), `APP_PUBLIC_URL` (the **frontend** origin, used in
  certificate QR codes), `CORS_ORIGIN` (frontend origin(s) allowed to upload
  directly, comma-separated), `REQUIRE_TEACHER_APPROVAL` (default `false`),
  `UPLOAD_DIR` (default `uploads`), `UPLOAD_MAX_BYTES` (25 MB),
  `UPLOAD_VIDEO_MAX_BYTES` (500 MB), seed passwords `SEED_STUDENT_PASSWORD` /
  `SEED_TEACHER_PASSWORD` / `SEED_PLATFORM_ADMIN_PASSWORD`. Don't put `PORT`/`NODE_ENV`
  in `.env`.
- **Frontend** (`frontend/.env.local` locally; Vercel project env): only
  `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:4000`; build-time). No secrets.

### Demo accounts (seeded, idempotent)
`student@afe.edu` / `Student@123` (approved) · `teacher@afe.edu` / `Teacher@123` ·
platform admin username **`Moocs@admin`** (email `admin@afe.edu`) / `Admin@123`.
Instructor/admin display names are all "Dr Sudhanshu Joshi".

## Deployment

Primary: **`DEPLOY.md`** — **frontend on Vercel** (Root Directory `frontend`, env
`NEXT_PUBLIC_BACKEND_URL`) and **backend on Render** (`render.yaml` Blueprint:
`rootDir: backend`, health check `/api/health`, Persistent Disk at `/var/data` for
uploads — Render's normal filesystem is wiped on every deploy/restart and disks need a
paid instance).
- Set the backend's `APP_PUBLIC_URL` and `CORS_ORIGIN` to the Vercel URL; set the
  frontend's `NEXT_PUBLIC_BACKEND_URL` to the Render URL and redeploy (build-time).
- Free Render instances sleep after ~15 min; middleware gives up after 10 s and the
  landing pages fall back to client-side fetching.

Self-hosted alternative: **`DEPLOY_AWS.md`** + `backend/deploy/` — both apps on one
EC2 box under PM2 (`ai-spark-api` :4000, `ai-spark-web` :3000) behind Apache
(`backend/deploy/apache-ai-spark.conf`, what the live box at `13-205-19-221.sslip.io`
runs) or nginx (`backend/deploy/nginx.conf`): `/api/*` → :4000, everything else →
:3000. Keep the two proxy configs in step (520 MB bodies, 15-min timeouts, Apache
forces `no-cache` on HTML). TLS is required — the `secure` `afe_session` cookie is
dropped over plain HTTP. `backend/uploads/` holds uploaded lesson files — exclude it
from deploy syncs and back it up.
