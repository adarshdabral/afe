# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A MOOC / online-learning platform ("AI on Wheels" presenting the course "Demystifying
AI for Everyone", slug `demystifying-ai-for-everyone`) for the Centre of Excellence in Logistics & Supply Chain Management, Doon
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
registration+approval, the Course CMS (courses → sections; modules → lesson containers → topics), assessments &
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
npm run seed         # demo users + standardize content to the single "Demystifying AI for Everyone" course
npm run seed:flagship # same, but leaves every other course untouched (--keep-others)

# --- frontend/ (UI, http://localhost:3000) — config in frontend/.env.local ---
npm install
npm run dev          # next dev
npm run build        # next build (type-checks; eslint is ignored during build)
npm run start        # next start
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . (flat config: frontend/eslint.config.mjs)
```

`npm run seed` (`backend/server/seed/course.seed.ts`) is **destructive to other courses**: it
soft-deletes every course except "Demystifying AI for Everyone" and (re)builds that course's 12
modules, lesson containers, seven topics per module and assessments. Use `npm run seed:flagship` to (re)build only the
flagship and keep other courses. Neither is run on server startup.

**There is no unit-test framework.** Verification is done with live end-to-end
harnesses in **`backend/verify/*.mts`**, which boot an ephemeral in-memory MongoDB
(`mongodb-memory-server`) + the **real backend app in-process** (`verify/_server.mts`:
production build in **`.next-verify/`** — separate from `.next/` so harnesses can run
while `npm run dev` is running — rebuilt automatically when sources are newer) and
assert against it over HTTP. Harnesses never see your `backend/.env`: keys it defines
that the harness doesn't set are blanked (all config treats blank as unset). Running in-process lets harnesses flip env flags (e.g.
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
npx tsx verify/course-cms-check.mts      # Course CMS: course/section/module/lesson/topic CRUD, ordering, visibility
npx tsx verify/migration-check.mts       # legacy content/progress migration and idempotent rerun
npx tsx verify/course-content-check.mts  # seed: Demystifying AI for Everyone is the only course, 12 modules, quiz mix
npx tsx verify/upload-check.mts          # uploads: RBAC, 415/413/400, Range/206, upload tokens, CORS, topics
npx tsx verify/media-check.mts           # multi-part topics, presign (local + R2), >10 MB upload, subtitles, TTS (fake Cloudflare)
npx tsx verify/learning-engine-check.mts # catalog visibility, topic ordering, role-scoped topic nav
npx tsx verify/assessment-check.mts      # quizzes: CRUD/publish, grading, pass/fail, answer-key hiding
npx tsx verify/progress-check.mts        # topic sequential locking, module/course completion, persistence
npx tsx verify/certificate-check.mts     # auto-issue, verify, PDF download, revoke, access control
npx tsx verify/reviews-check.mts         # reviews & ratings
npx tsx verify/course-overview-check.mts # course-page metadata (skills/tools/offered by) + per-student module "left" summary
npx tsx verify/content-cache-check.mts   # content cache: every admin write type is visible on the next read; ?view=outline
npx tsx verify/perf-bench.mts            # NOT pass/fail: latency + DB round trips per hot endpoint (DB_RTT_MS=50 default)
npx tsx verify/feature-check.mts         # seed identities / self-registration rules
npx tsx verify/branding-check.mts        # logo: public read, admin-only write, URL validation, SVG CSP
npx tsx verify/e2e-student-journey.mts   # register → learn → quiz → complete → certificate → verify
npx tsx verify/e2e-admin-journey.mts     # teachers → courses/modules/lessons/topics → assessments → certs
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
| `/api/branding`, `/api/admin/branding` | public read; platform_admin write | platform logo (`SiteSetting` doc `"branding"`) |
| `/api/admin/courses` | platform_admin | course/module/lesson-container/topic CRUD, ordering, publish/unpublish/archive |
| `/api/admin/courses/:courseId/sections/:kind` | platform_admin | edit Introduction, Overview and Instructor course sections |
| `/api/admin/courses/lessons/:lessonId/topics` | platform_admin | topic CRUD and ordering within lesson containers |
| `/api/admin/assessments` | platform_admin | assessment + question CRUD, reorder, publish |
| `/api/admin/uploads` | platform_admin | `/presign` (R2 URL or local target), `/config`, `/token`; local multipart upload (`file` field) at `/`, `/video`, `/audio`, `/subtitle` |
| `/api/admin/tts` | platform_admin | text-to-speech narration → MP3 URL |
| `/api/uploads/<file>` | public, read-only | `app/api/uploads/[...path]` streams from `UPLOAD_DIR` (Range/206) |
| `/api/courses` | public (optional auth) | published catalog and course tree (sections, modules, lesson containers and topics) |
| `/api/courses/:slug/topics/:topicId` | public (optional auth) | role-scoped topic content |
| `/api/assessments` | auth; attempts = student | answer-key-stripped quiz, submit attempt, my attempts |
| `/api/progress` | student | per-course progress, complete topic, visit and time tracking |
| `/api/certificates` | public verify; student; admin | verify, mine, claim, PDF download, list/revoke |
| `/api/analytics` | student push; teacher/admin read | progress snapshot sync, teacher/school/platform aggregates |
| `/api/forum` | auth; moderation = teacher/admin | threads, replies, moderate thread/post |
| `/api/courses/:id/reviews`, `/api/reviews/:id` | public read; auth write | reviews + rating aggregate |

### Domain rules worth knowing
- **Course hierarchy**: Course → three CourseSections (Introduction, Overview,
  Instructor) and Modules → Lesson containers → Topics. Modules, lessons and topics
  are sequenced by `order`; lessons and topics denormalize their parent ids. A lesson
  is a name with an optional description; a topic owns the learning content. Course
  `status` is `draft | published | archived`; courses
  are **soft-deleted** (`deletedAt`). `slug` is unique and the public lookup key.
  Students only ever see published content (role-scoped in `course.service.ts`).
- **Every module has a description, learning objectives (`learningObjectives:
  string[]`, 1–20, ≤300 chars each) and exactly ONE module assessment** (tests are per
  module, never per lesson — `Assessment.moduleId` is unique). **Publishing a module
  requires all three** (assessment published with ≥1 question): enforced in
  `module.service.ts` (`moduleReadiness`/`readinessFrom`, 409 listing what's
  missing; a module can't be created already-published). A published module can't
  lose them: clearing its description/objectives → 409; unpublishing/deleting its
  assessment, or deleting its last question → 409 (hide the module first). ADDING
  content to a published module is always allowed (older modules were published
  before objectives existed). `defineModel` re-registers a model whose schema fields
  changed, so `next dev` hot-reload never keeps a stale model that drops new fields. The admin
  course tree carries `modules[].readiness`; the CMS shows a publish checklist.
  Verify harnesses publish modules via `verify/_fixtures.mts` (`publishModule`).
  Existing data: `npm run backfill:objectives` fills seeded objectives by module
  title without rebuilding the course.
- **Topics and course sections are multi-part content**: any combination of `content` (markdown text),
  `audioUrl` (narration — uploaded, or generated from the text via text-to-speech),
  `documentUrl` (PDF/PPT or image) and `videoUrl` + `subtitleUrl` (WebVTT captions;
  the admin UI converts `.srt` → `.vtt` in the browser, `srtToVtt()`). `contentType`
  (`CONTENT_TYPES`, duplicated in `backend/server/models/content.ts` and
  `frontend/lib/api/courses.ts` — keep in sync: `video`, `pdf`, `presentation`,
  `rich_text`, `infographic`, `case_study`, `reflection`, `activity`) is only the
  primary-format label. `frontend/components/learn/ContentRenderer.tsx` renders every
  part present (video+captions → audio → text → document; .pptx at an https URL via
  the Office web viewer); `frontend/components/course/TopicEditor.tsx` edits topics,
  while `ContentEditor.tsx` is shared with course sections.
- **Lesson media storage** — **Cloudflare R2** when `R2_*` is configured
  (`backend/server/utils/r2.ts`), else the backend's disk
  (`backend/server/utils/storage.ts`). One flow for every kind (`document`, `video`,
  `audio`, `subtitle` — per-kind ext **and** MIME allow-list + size cap):
  `frontend/lib/api/uploads.ts` → `POST /api/admin/uploads/presign {kind, filename,
  contentType, size}` (415/413 checked first) →
  - **R2 mode**: a 1-hour presigned PUT URL bound to Content-Type + Content-Length
    (path-style `https://<acct>.r2.cloudflarestorage.com/<bucket>/<kind>/yyyy/mm/<random>`);
    the browser PUTs straight to R2 and the lesson stores the public URL
    (`R2_PUBLIC_URL/<key>`). The bucket needs CORS (`npm run r2:cors`).
  - **Local mode**: `{uploadPath, token}` — the browser POSTs multipart straight to
    the backend (`/api/admin/uploads[/video|/audio|/subtitle]`) with the upload-scoped
    JWT (`handle()` rejects it on every non-upload endpoint); busboy streams it to
    `UPLOAD_DIR` (on Render a Persistent Disk); served by `/api/uploads/*` (Range,
    `Access-Control-Allow-Origin: *`). `resolveUploadUrl()` points `/api/uploads/…`
    at the backend origin.
  - **CORS for those direct calls lives in `handle()` (`cors: true` + `export const
    OPTIONS = preflight`) — never add a backend `middleware.ts` on upload paths:**
    Next.js buffers and truncates middleware request bodies at 10 MB (this broke
    video uploads once; `verify/media-check.mts` uploads 12 MB as a regression test).
- **Text-to-speech** (`backend/server/services/tts.service.ts`, `POST /api/admin/tts`):
  Cloudflare Workers AI REST (`CLOUDFLARE_AI_TOKEN`; default **`@cf/deepgram/aura-2-en`**
  `{text, speaker}` → MP3, default voice `TTS_VOICE`=`orion` (male); the editor offers
  `VOICE_CHOICES` and the API validates against `AURA_SPEAKERS`. `TTS_MODEL=@cf/myshell-ai/melotts`
  → `{prompt, lang}` → **WAV** (base64 in a JSON envelope), single voice). Neither model
  has a speed setting — `components/learn/NarrationPlayer.tsx` plays at 0.9× by default
  with a speed menu (pitch preserved; choice remembered per device).
  Markdown is stripped, text split into ≤800-char chunks synthesized in order, then
  joined by format (`joinAudio`: WAV merged under one rebuilt RIFF header, MP3
  concatenated) and stored in R2 (or locally). WAV is ~5 MB/min of speech.
  Max 30,000 characters. 503 when not configured (the editor disables the button via
  `GET /api/admin/uploads/config`).
- **Assessments**: one per module. Question types are `mcq | reflection | scenario`
  (True/False is modelled as a two-option `mcq`). MCQ is auto-graded; open-ended
  (reflection/scenario) earns full marks for a non-empty answer. Pass = % ≥
  `passingScore`. The student fetch strips answer keys.
- **Progress** (`progress.service.ts`): one doc per (student, course). Enforces
  **sequential locking** (topic N requires N-1), derives module/course completion
  and `certificateEligible`, and **auto-issues the certificate** when eligible.
- **Certificates**: idempotent per (student, course), ids `AFE-YYYY-XXXXXXXX`,
  branded PDF via `pdf-lib` with a QR code pointing at `/certificate/verify/<id>`
  (origin from `APP_PUBLIC_URL`; `CORS_ORIGIN` is a legacy fallback). Admins can revoke.
- **Reviews** recompute a per-course `CourseRating` aggregate after every mutation.
- **Course-page metadata** lives on `Course`: `instructorTitle` (badge credential line),
  `skills` / `tools` (chip lists, trimmed + de-duplicated, ≤30) and `offeredBy
  {name, logoUrl, description, url}` (PATCH merges keys). Edited in the course builder's
  "Course page details" panel (`components/course/CourseDetailsEditor.tsx`), rendered by
  `components/course-landing/CourseHighlights.tsx`. Existing DBs: `npm run
  backfill:course-meta` fills only empty values for the flagship (+ assessment estimates).
- **Module "left" summary** (`X graded assignments left · Y lessons left · Z left`,
  `components/learn/ModuleProgressSummary.tsx`) is never stored: `moduleRemaining()` in
  `frontend/lib/progress.ts` derives it from the course tree + the student's progress
  (completed topics; assessments count as done only when **passed**). "Lessons" = topics.
  Time = unfinished topics' `estimatedDurationMinutes` + the module assessment's
  `estimatedDurationMinutes` (tree: `modules[].assessmentDurationMinutes`; 0 = no estimate).
- **Performance / caching** — keep these when changing data access:
  - **Backend content cache** (`server/cache/content-cache.ts`): the published course
    tree, the progress topic sequence, published-assessment ids and branding are
    cached in-process (60 s TTL). Every content model calls `invalidateOnWrite(schema)`
    so ANY write clears it — **a new model whose data feeds a cached read must do the
    same**. Cached values are shared: never mutate what `cachedContent()` returns.
    Admin reads (`platform_admin`) bypass the cache.
  - Course tree queries run in one parallel round with `.lean()`; `listSections` only
    back-fills when sections are missing. Progress writes are single atomic upserts
    (`upsertProgress`, retries the duplicate-key race).
  - `GET /api/courses/:slug?view=outline` omits topic text bodies (sections keep
    theirs); learn pages use it and fetch a topic's body from
    `/api/courses/:slug/topics/:id`.
  - **Frontend**: learn pages load via `hooks/use-learn-course.ts` (`useLearnCourse`,
    `useLearnTopic`, `prefetchTopic`) — a module-level stale-while-revalidate cache
    (30 s) shared across learn pages, and `LearningContext.load()` skips same-course
    reloads for 30 s unless `{ force: true }` (used after an assessment attempt).
    Landing pages cache backend data for 60 s with `unstable_cache`
    (`lib/server/course.ts`; failures are never cached), so public edits reach `/` and
    `/courses/[slug]` within a minute.
- Course Introduction / Overview / Instructor sections are auto-created empty; public
  pages render one only when it has content (`hasSectionContent` / `contentSection` in
  `lib/course.ts`).

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
- **`LearningContext`** owns the active course's learning state (completed topics,
  current lesson, progress) backed by the progress API.
- **Single-course product**: public pages present one flagship course ("Demystifying
  AI for Everyone", `FLAGSHIP_SLUG` in `frontend/lib/course.ts`, mirrors
  `AI_COURSE_META.slug` in `backend/server/seed/ai-course.data.ts`). `/` and
  `/courses/[slug]` are dynamic server components that fetch the course outline from
  the backend (`lib/server/course.ts`, lesson bodies stripped; client-side retry if
  the backend is asleep) and render `components/course-landing/*`; `/courses` redirects to the
  flagship. Platform brand is "AI on Wheels" (`PLATFORM_NAME`); the course is "Demystifying
  AI for Everyone". The old slug `ai-for-everyone` is renamed in place on startup
  (`server/migrations/rename-course-slug.ts`) and redirected in `next.config.ts`.
- **Branding**: the logo uploaded at `/admin/branding` replaces the default Sparkles mark
  everywhere — always render the brand with `components/BrandMark.tsx` (reads
  `BrandingContext`, seeded server-side in `app/layout.tsx`), never a bare `<Sparkles />`.
- Route map: public `/`, `/courses` (redirect), `/courses/[slug]`, `/certificate/verify{,/[id]}`;
  auth `/login`, `/register`, `/forgot-password` (UI only — no reset backend);
  learner `/learn/[slug]{,/section/[kind],/module/[moduleId],/topic/[topicId],/assessment/[assessmentId]}`;
  `/student/{dashboard,certificates,forum,pending}`;
  `/instructor/{dashboard,approvals,analytics,forum}`;
  `/admin/{dashboard,courses/**,teachers/**,certificates,analytics,branding}`.

### UI conventions
- shadcn/ui ("new-york") in `frontend/components/ui/`. Icons: **lucide-react**. Class
  merge: `cn()` from `frontend/lib/utils.ts`. Toasts: **sonner**. Charts: **recharts**.
  Path alias `@/` → the app root (`frontend/`), configured in `frontend/tsconfig.json`.
- Accent is violet-600; cards `bg-card rounded-3xl border border-border shadow-soft`.
- The three surfaces — student, instructor, admin — each have a sidebar
  (`StudentSidebar`/`InstructorSidebar`/`AdminSidebar`). CMS building blocks live in
  `components/course/` (`ContentEditor`, `TopicEditor`, `AssessmentBuilder`, `Reorderable`,
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
  **Cloudflare**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET`, `R2_PUBLIC_URL` (all five → R2 mode), `CLOUDFLARE_AI_TOKEN`
  (+ optional `CLOUDFLARE_ACCOUNT_ID`, `TTS_MODEL`, `TTS_VOICE`, `TTS_LANG`). Local fallback:
  `UPLOAD_DIR` (default `uploads`), caps `UPLOAD_MAX_BYTES` (25 MB),
  `UPLOAD_VIDEO_MAX_BYTES` (500 MB), `UPLOAD_AUDIO_MAX_BYTES` (100 MB),
  `UPLOAD_SUBTITLE_MAX_BYTES` (2 MB) — blank env values count as unset. Seed passwords `SEED_STUDENT_PASSWORD` /
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
