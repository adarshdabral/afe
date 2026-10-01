# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A MOOC / online-learning platform ("ai-spark" / "AI For Everyone") for the Centre of
Excellence in Logistics & Supply Chain Management, Doon University. It is a **two-app
monorepo**:

- **`frontend/`** — Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui ("new-york").
- **`backend/`** — Express 4 + Mongoose 8 (MongoDB) + JWT auth. Pure ESM, run with `tsx`.

For a product-level list of what the platform does (and how it is operated), see
**`FEATURES.md`**.

> **The app was migrated from TanStack Start → Next.js/Express/MongoDB.** The old
> TanStack app now lives in **`legacy-backup/`** (rollback snapshot — do not edit or
> import from it). Root-level `MIGRATION_PLAN.md`, `TARGET_ARCHITECTURE.md`, and
> `NEXTJS_MIGRATION_STATUS.md` document that migration. **Stale docs:** `DEPLOY.md`
> (Cloudflare/TanStack) and `PROJECT_MEMORY.md` (describes the old TanStack/mock-data
> app) — don't follow their conventions. The current deploy guide is
> **`DEPLOY_AWS.md`**. The root `src/` (just `start.ts`) and root config files are
> legacy leftovers; all live code is under `frontend/` and `backend/`.

**All domain data is server-side (MongoDB).** Auth/sessions, student
registration+approval, the Course CMS (courses → modules → lessons), assessments &
attempts, per-student progress, certificates, analytics, forum, reviews/ratings, and
uploaded lesson files are all real and backend-owned. There is **no mock course
content** any more (`frontend/data/` is empty). The only client-only state is the
dark-mode preference.

## Commands

Each app has its own `package.json` and `node_modules`. Run commands **inside** the
respective directory. Both apps use npm (`package-lock.json`), not Bun (Bun was the
legacy tooling).

```bash
# --- backend/ (Express API, default port 4000) ---
npm install
npm run dev          # node --env-file-if-exists=.env --import tsx --watch src/index.ts (needs MongoDB)
npm run build        # tsc → dist/  (note: emits extensionless ESM; see PM2 note below)
npm run start        # node dist/index.js
npm run seed         # demo users + standardize content to the single "AI for Everyone" course

# --- frontend/ (Next.js, default port 3000) ---
npm install
npm run dev          # next dev
npm run build        # next build (type-checks; eslint is ignored during build)
npm run start        # next start
npm run lint         # next lint
```

`npm run seed` (`seed/course.seed.ts`) is **destructive to other courses**: it
soft-deletes every course except "AI for Everyone" and (re)builds that course's 12
modules, lessons and assessments. It is intentionally *not* run on server startup.

**There is no unit-test framework.** Verification is done with live end-to-end
harnesses in **`backend/verify/*.mts`**, which boot an ephemeral in-memory MongoDB
(`mongodb-memory-server`) + the real Express app and assert against it. Run one with
`tsx` from `backend/`:

```bash
npx tsx verify/runtime-check.mts         # broad API checks (auth, registration, RBAC, forum, analytics…)
npx tsx verify/auth-check.mts            # login by email/username, cookie, /me, approval-mode toggle
npx tsx verify/rbac-check.mts            # guardRedirect matrix
npx tsx verify/rbac-access-check.mts     # route guard + live API 401/403 matrix per role
npx tsx verify/middleware-e2e.mts        # real `next start` + API: asserts middleware redirects
npx tsx verify/registration-check.mts    # student registration workflow (approve/reject/ownership)
npx tsx verify/teacher-check.mts         # teacher-management CRUD (/api/admin/teachers)
npx tsx verify/course-cms-check.mts      # Course CMS: course/module/lesson CRUD, ordering, visibility
npx tsx verify/course-content-check.mts  # seed: AI for Everyone is the only course, 12 modules, quiz mix
npx tsx verify/upload-check.mts          # lesson-file upload: RBAC, 415/413/400, presentation lessons
npx tsx verify/learning-engine-check.mts # catalog visibility, lesson ordering, role-scoped lesson nav
npx tsx verify/assessment-check.mts      # quizzes: CRUD/publish, grading, pass/fail, answer-key hiding
npx tsx verify/progress-check.mts        # sequential locking, module/course completion, persistence
npx tsx verify/certificate-check.mts     # auto-issue, verify, PDF download, revoke, access control
npx tsx verify/reviews-check.mts         # reviews & ratings
npx tsx verify/feature-check.mts         # seed identities / self-registration rules
npx tsx verify/e2e-student-journey.mts   # register → learn → quiz → complete → certificate → verify
npx tsx verify/e2e-admin-journey.mts     # teachers → courses/modules/lessons → assessments → certs
npx tsx verify/serve.mts                 # boot API on :4000 against ephemeral Mongo (manual probing)
```

When you change backend behavior, run the relevant `verify/*.mts` harness — that is
the project's substitute for a test suite. Add a new harness for a new feature.

## Architecture

### Backend: layered Express (route → controller → service → Mongoose model)
Consistent per-feature layering under `backend/src/` — follow it for new features:
- **`routes/*.routes.ts`** — mount handlers; wrap every async handler in
  `asyncHandler(...)` (from `utils/asyncHandler.ts`) so rejections reach the central
  error handler. Apply `authenticate` / `optionalAuthenticate` / `requireRole(...)`
  here. Admin-only routers apply `router.use(authenticate, requireRole("platform_admin"))`.
- **`controllers/*.controller.ts`** — parse/validate input with **zod** (`schema.parse(req.body)`),
  call the service, shape the HTTP response.
- **`services/*.service.ts`** — business logic + Mongoose queries. No `req`/`res`.
- **`models/*.ts`** — Mongoose schemas, each with a `to<Entity>()` mapper producing a
  plain `*View` object (string `id`, ISO timestamps) — return views, never raw docs.
  **`User` uses string `_id`s** (`usr-<uuid>`, or fixed `u-*` for seeds) so seeded ids
  line up with the teacher directory (`u-teacher`) and analytics cohort
  (`u-student`) — don't assume ObjectIds. Cross-entity references (`courseId`,
  `moduleId`, `studentId`…) are stored as strings.
- **Static content** for the seeded course lives in `src/data/` (`curriculum.ts`,
  `assessments.ts`) and `src/seed/ai-course.data.ts`.
- Response envelope convention: success → `{ data: ... }`, error → `{ error: { message } }`.
  Routes are all mounted under `/api` (reviews at bare `/api`, others at `/api/<feature>`).
- **Central error handler** in `index.ts`: `ZodError` → 400; `MulterError` → 413
  (file too large) / 400; any error carrying a numeric `statusCode` → that status
  (use this to throw typed HTTP errors from services/middleware); else 500.
- `index.ts` is the single entry: middleware → `/api/health` → `/api/uploads` static
  → route mounts → central error handler → `start()` which `connectDb()` then runs
  idempotent seeds (`seedDemoUsers`, `seedAnalyticsCohort`, `seedForum`) before `listen`.

### API surface (mount points)
| Mount | Who | Purpose |
|---|---|---|
| `/api/auth` | public / any | login (email **or** username), register, `me`, logout |
| `/api/registrations` | public + teacher/admin | teacher directory, self-registration, approval queue, decide |
| `/api/admin/teachers` | platform_admin | teacher CRUD, activate/deactivate, reset password |
| `/api/admin/courses` | platform_admin | course/module/lesson CRUD, reorder, publish/unpublish/archive |
| `/api/admin/assessments` | platform_admin | assessment + question CRUD, reorder, publish |
| `/api/admin/uploads` | platform_admin | multipart upload (`file` field) of lesson materials; `/video` for lesson videos |
| `/api/uploads/<file>` | public, read-only | `express.static` over `UPLOAD_DIR` |
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
  `backend/src/models/Lesson.ts` and `frontend/lib/api/courses.ts` — keep in sync):
  `video`, `pdf`, `presentation`, `rich_text`, `infographic`, `case_study`,
  `reflection`, `activity`. Rendered by `frontend/components/learn/LessonRenderer.tsx`,
  edited by `frontend/components/course/LessonEditor.tsx`.
- **Uploads** (`utils/storage.ts`): multer disk storage into `UPLOAD_DIR` (default
  `backend/uploads/`, git-ignored — **must persist across deploys**), random
  filenames, allow-list of PDF/PPT/PPTX/PNG/JPG/GIF/WEBP/SVG (ext **and** MIME), 25 MB
  cap. The returned root-relative `/api/uploads/<file>` URL is stored as a lesson's
  `documentUrl`. **Lesson videos** go to `POST /api/admin/uploads/video` (separate
  multer instance: MP4/M4V/WebM/MOV, `UPLOAD_VIDEO_MAX_BYTES` cap) and the URL is
  stored as `videoUrl`. Frontend renders uploaded URLs via `resolveUploadUrl()`
  (prefixes the API origin in dev). Proxy body limits are sized for 500 MB videos.
- **Assessments**: one per module. Question types are `mcq | reflection | scenario`
  (True/False is modelled as a two-option `mcq`). MCQ is auto-graded; open-ended
  (reflection/scenario) earns full marks for a non-empty answer. Pass = % ≥
  `passingScore`. The student fetch strips answer keys.
- **Progress** (`progress.service.ts`): one doc per (student, course). Enforces
  **sequential locking** (lesson N requires N-1), derives module/course completion
  and `certificateEligible`, and **auto-issues the certificate** when eligible.
- **Certificates**: idempotent per (student, course), ids `AFE-YYYY-XXXXXXXX`,
  branded PDF via `pdf-lib` with a QR code pointing at `/certificate/verify/<id>`
  (origin from `APP_PUBLIC_URL` → `CORS_ORIGIN`). Admins can revoke.
- **Reviews** recompute a per-course `CourseRating` aggregate after every mutation.

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
  **If you change one, change the other.** Guarded prefixes: `/student` (student),
  `/learn` (all roles), `/instructor` (teacher + admin), `/admin` (platform_admin).
- **Two enforcement layers**: (1) `frontend/middleware.ts` is the UX guard — it calls
  `GET /api/auth/me` **server-side via `INTERNAL_API_URL`** (default
  `http://127.0.0.1:4000/api`, never the public hostname) and applies
  `guardRedirect`. (2) The Express API is the real authority — every protected
  endpoint enforces `authenticate`/`requireRole`. Don't rely on the middleware for
  security.
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
- **Data fetching is Axios + `useEffect`**, deliberately *not* React Query. The shared
  instance is `frontend/lib/api/axios.ts` (`withCredentials: true`); per-feature typed
  wrappers live in `frontend/lib/api/*.ts` (`auth`, `registrations`, `teachers`,
  `courses`, `assessments`, `progress`, `uploads`, `analytics`, `forum`,
  `certificates`, `reviews`). Browser API base is `NEXT_PUBLIC_API_BASE_URL` (in
  production a same-origin `/api`; dev default `http://localhost:4000/api`).
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
  `AI_COURSE_META.slug`). `/` and `/courses/[slug]` are server components that fetch
  the course outline via `INTERNAL_API_URL` (`lib/server/course.ts`, lesson bodies
  stripped) and render `components/course-landing/*`; `/courses` redirects to the
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
- `next.config.ts` sets `eslint.ignoreDuringBuilds: true` **on purpose** — the frontend
  sits inside the legacy repo whose root eslint flat config gets picked up by ESLint's
  upward search and fails `next build` on formatting rules. Type-safety is still
  enforced by `tsc`/`next build`. Don't remove this without fixing the root cause.

### Environment variables
- **Backend** (`backend/.env`, loaded via Node `--env-file`; read at module scope in
  `config/env.ts`): `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET` (≥32 chars;
  **required in production**, dev has an insecure fallback), `CORS_ORIGIN`,
  `REQUIRE_TEACHER_APPROVAL` (default `false`), `APP_PUBLIC_URL` (certificate QR
  origin), `UPLOAD_DIR` (default `uploads`), `UPLOAD_MAX_BYTES` (default 25 MB),
  `UPLOAD_VIDEO_MAX_BYTES` (default 500 MB, lesson videos). Seed
  passwords: `SEED_STUDENT_PASSWORD` / `SEED_TEACHER_PASSWORD` /
  `SEED_PLATFORM_ADMIN_PASSWORD`.
- **Frontend**: `NEXT_PUBLIC_API_BASE_URL` (public, inlined at **build** time — set it
  before `next build`) and `INTERNAL_API_URL` (server-only, used by middleware). No
  secrets client-side.

### Demo accounts (seeded, idempotent)
`student@afe.edu` / `Student@123` (approved) · `teacher@afe.edu` / `Teacher@123` ·
platform admin username **`Moocs@admin`** (email `admin@afe.edu`) / `Admin@123`.
Instructor/admin display names are all "Dr Sudhanshu Joshi".

## Deployment

See **`DEPLOY_AWS.md`**. Single EC2 box runs both apps under **PM2**
(`deploy/ecosystem.config.cjs`, run from the repo root) behind a single-origin
reverse proxy: `/` → Next.js :3000, `/api/*` → Express :4000. MongoDB is on Atlas.
- Two equivalent proxy configs exist: `deploy/nginx.conf` (what `DEPLOY_AWS.md`
  describes) and **`deploy/apache-ai-spark.conf`** (what the live box at
  `13-205-19-221.sslip.io` actually runs). Keep them in step. Apache additionally
  sets `LimitRequestBody` 30 MB (nginx still has `client_max_body_size 10M` — raise
  it if nginx is used, or uploads >10 MB fail) and forces `no-cache` on HTML so
  stale pages never reference deleted `/_next/static` chunks after a deploy.
- Single-origin + Let's Encrypt TLS is **required** — the `secure` `afe_session`
  cookie is dropped over plain HTTP and login silently fails. The proxy must send
  `X-Forwarded-Proto: https`.
- The backend runs from **TS source via `tsx`** under PM2 (not `dist/`), because
  `tsc` emits extensionless ESM imports that Node's native loader rejects.
- `backend/uploads/` holds admin-uploaded lesson files — exclude it from deploy
  syncs and back it up; it is not in MongoDB.
