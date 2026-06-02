# MIGRATION_PLAN.md

Migration of **ai-spark** ("AI For Everyone") from **TanStack Start** (full-stack React/SSR on Cloudflare Workers) to a split **Next.js (App Router) frontend + Express/MongoDB backend** with JWT auth.

> Status: analysis only. No code written, no existing files modified.

---

## A. Current System Analysis

### Routing
- **TanStack Start file-based routing** in `src/routes/`, dot-separated filenames (`student.dashboard.tsx` → `/student/dashboard`), bare `$` dynamic segments (`courses.$id.tsx` → `/courses/:id`). `routeTree.gen.ts` is generated.
- Single app shell `src/routes/__root.tsx` (`createRootRouteWithContext`) mounts `QueryClientProvider`, `AppProvider`, `Toaster`, 404/error boundaries, and the **auth gate in `beforeLoad`**.
- 27 routes across four surfaces: public (`index`, `courses`, `courses.$id`), auth (`login`, `register`, `forgot-password`, `verify.$token`), `student.*` (11), `instructor.*` (5), `admin.*` (2).

### Authentication
- Real server-side auth in `src/lib/auth/`. **Sealed `httpOnly` cookie session** (`afe_session`) via TanStack `useSession` (`session.server.ts`).
- **PBKDF2-HMAC-SHA256 password hashing via Web Crypto** (portable across Node/Workers, no native bcrypt).
- **RBAC**: `access.ts` (isomorphic) is the single source of truth — `ROUTE_ACCESS` prefix→roles map, `roleHome`, pure `guardRedirect`. Roles: `student`, `teacher`, `school_admin`, `platform_admin`, mapped onto three UI surfaces.
- **Single gate**: root `beforeLoad` resolves the user (React Query key `["currentUser"]`) then applies `guardRedirect`, including the student pending/approval funnel (FR-01/FR-02).

### Server-side
- Two-file pattern per feature: `*.functions.ts` = `createServerFn` RPC surface (zod `.inputValidator`, server-only tree-shaken handlers); `*.server.ts` = server-only implementation/state/secrets.
- Server entry redirected to `src/server.ts` (SSR error wrapper); `src/start.ts` adds middleware.
- RPC inventory:
  - **auth**: `loginFn`, `logoutFn`, `getCurrentUserFn`
  - **registration**: `getRegistrationDirectoryFn`, `registerStudentFn`, `myRegistrationFn`, `pendingRegistrationsFn`, `decideRegistrationFn`
  - **analytics**: `syncMyProgressFn`, `teacherAnalyticsFn`, `schoolAnalyticsFn`, `platformAnalyticsFn`
  - **certificates**: `issueCertificateFn`, `myCertificateFn`, `verifyCertificateFn`
  - **forum**: `listThreadsFn`, `getThreadFn`, `createThreadFn`, `replyFn`, `moderateThreadFn`, `moderatePostFn`

### Data storage
- **In-memory stores** (`Map`/arrays) in `*.server.ts` — the explicit, documented seam to Postgres: `users`, `registrations` (schools, teachers, requests, notifications), `analytics` (snapshots), `certificates`, `forum` (threads/posts). Reset on restart, not shared across instances.
- **Static content** in `src/data/`: `mock.ts` (courses, modules, lessons, instructors, certificates, admin/instructor entities, types), `curriculum.ts` (~30KB curriculum), `assessments.ts` (assessment definitions + `gradeAssessment` grading engine, `PASS_PERCENTAGE`).

### State management
- `src/context/AppContext.tsx` (`useApp()`) + React Query. Holds (1) **session identity** (`authUser`, `role`, `isAuthenticated`, `logout`) from `getCurrentUserFn` under `["currentUser"]`; (2) **client UI/course-engine state** (enrollment, progress, notes, reflections, `assessmentScores`, `timeSpent`, dark mode, admin queues).
- `localStorage` `afe.*` keys persist: `darkMode`, `notes`, `completedLessons`, `reflections`, `assessmentScores`, `timeSpent`.

### Deployment
- **Cloudflare Workers** via Nitro (`wrangler.toml`: `main = dist/server/server.js`, assets `dist/client`). Build wrapped by `@lovable.dev/vite-tanstack-config` (Vite 7). Bun package manager (`bunfig.toml` 24h supply-chain guard).
- Env: `SESSION_SECRET` (≥32 chars, required in prod), `SEED_*_PASSWORD`, `VITE_*` public vars; env reads per-request (Workers binding).

### Dependencies (notable)
- Framework: `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `nitro`, `vite`, `@lovable.dev/vite-tanstack-config`.
- UI: React 19, Tailwind v4 (`@tailwindcss/vite`), 26× `@radix-ui/*`, shadcn/ui (new-york), `lucide-react`, `sonner`, `recharts`, `react-hook-form`, `zod`, `cmdk`, `vaul`, `embla-carousel-react`, `date-fns`, `canvas-confetti`, `class-variance-authority`, `clsx`, `tailwind-merge`.

---

## B. Migration Impact Analysis

### Reused directly (move with ~no logic change)
- `src/components/ui/*` (shadcn/Radix), `CourseCard`, `CertificateCard`, sidebars, `ForumView`, `LessonContentView`, `Navbar`.
- `src/data/*` (`mock.ts`, `curriculum.ts`, `assessments.ts`) — becomes Mongo seed data + frontend static content; the **`gradeAssessment` engine and `access.ts` RBAC rules are pure and portable to the backend**.
- Password hashing logic (`hashPassword`/`verifyPassword`, PBKDF2) — portable to Node as-is (or swap to `bcrypt`).
- Tailwind config/styles, `cn()` util, `categoryColor`, `progress.ts` (pure), hooks (`use-lesson-timer`, `use-mobile`).
- Domain/DTO TypeScript types (shared between frontend and backend).

### Partial modification
- **Routing**: every `routes/*.tsx` re-homed to App Router folders; `Link`/navigation → `next/link` + `next/navigation`; loaders/`beforeLoad` data → server components or Axios calls.
- **State/context**: `AppContext` kept conceptually, but server reads/writes switch from `createServerFn` calls to **Axios → Express**. React Query retained. `["currentUser"]` query now hits a `/api/auth/me` endpoint.
- **`__root.tsx`** → split into `app/layout.tsx` (providers/shell) + `app/error.tsx` + `app/not-found.tsx`; `beforeLoad` guard → **Next.js `middleware.ts`** (UX redirect) + Express JWT middleware (enforcement).
- **Server functions**: handler bodies become Express controllers; zod validators reused server-side.

### Completely replaced
- TanStack Start runtime, `@tanstack/react-router`, `routeTree.gen.ts`, `src/server.ts`/`src/start.ts`, `vite.config.ts`, Nitro, `@lovable.dev/vite-tanstack-config`, `wrangler.toml` → Next.js build + Express server.
- **In-memory `*.server.ts` stores → MongoDB collections via Mongoose**.
- **Sealed-cookie TanStack session → JWT** (issue/verify, `httpOnly` cookie or `Authorization: Bearer`).
- Cloudflare Workers deployment → Node host (frontend: Vercel/Node; backend: Node/container).

---

## C. Target Architecture

### Frontend — Next.js App Router
```
app/
  layout.tsx                 # providers (React Query, AppProvider, Toaster), shell  ← __root.tsx
  not-found.tsx  error.tsx
  page.tsx                   # /
  courses/page.tsx           courses/[id]/page.tsx
  (auth)/login  register  forgot-password  verify/[token]/page.tsx
  student/(dashboard|curriculum|progress|certificates|forum|pending)/page.tsx
  student/learn/[id]  lesson/[lessonId]  quiz/[id]  assessment/[moduleId]  assignment/[id]/page.tsx
  student/certificate/page.tsx
  instructor/(dashboard|create|approvals|analytics|forum)/page.tsx
  admin/(dashboard|analytics)/page.tsx
components/  lib/  context/  data/   # ported, mostly unchanged
middleware.ts                # edge RBAC redirect mirroring guardRedirect
lib/api/axios.ts             # Axios instance (baseURL, withCredentials, JWT interceptor)
```
- **Shared components**: keep `components/ui/*` and feature components verbatim; centralize all data access in an Axios client layer (replacing the `*.functions.ts` callables). Mark interactive trees `"use client"`; use server components for static catalog/curriculum pages where possible.
- **State**: retain `AppContext` + React Query. `localStorage` `afe.*` keys unchanged (or progressively moved server-side via the existing `syncMyProgress` concept). Session identity from `/api/auth/me`.

### Backend — Express
```
server/
  index.ts                   # app bootstrap, CORS, cookie-parser, json
  config/db.ts               # mongoose.connect
  models/                    # Mongoose schemas
  routes/                    # auth, registrations, analytics, certificates, forum, content
  controllers/               # ported *.functions.ts handler bodies
  services/                  # ported *.server.ts logic (Mongo-backed)
  middleware/                # authenticate, requireRole, schoolScope, errorHandler, validate(zod)
  utils/                     # password hashing, jwt
  seed/                      # mock.ts + curriculum.ts + assessments.ts → DB
```
- REST surface mirrors the RPC inventory (e.g. `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/registrations/directory`, `POST /api/registrations`, `GET /api/registrations/mine`, `GET /api/registrations/pending`, `POST /api/registrations/:id/decide`, `GET /api/analytics/{teacher,school,platform}`, `POST /api/analytics/progress`, certificates issue/mine/verify, forum threads/posts/moderation).

### MongoDB / Mongoose models
- **User** — `role`, `name`, `email`, `username`, `mobile`, `passwordHash`, `registrationStatus` (students), `schoolIds` (teachers).
- **School**, and teacher directory (embed `schoolIds` on teacher Users or a `TeacherDirectory` doc).
- **RegistrationRequest** — student/class/roll/school/teacher, `status`, decision metadata.
- **Notification** — per-user feed (type, message, read).
- **Certificate** — student/course/school, verification token.
- **AnalyticsSnapshot** — per-student progress snapshot (school/class scoped).
- **ForumThread**, **ForumPost** — with `hidden` moderation flag, paging.
- **Content** (Course/Module/Lesson, Assessment) — seeded from `src/data/`; may stay static in frontend if not mutated.

### Authentication — JWT
- **Flow**: `POST /api/auth/login` → verify password (reused PBKDF2/bcrypt) → sign JWT (`{ sub, role, registrationStatus }`) → set `httpOnly` cookie (+ optional refresh token). `GET /api/auth/me` re-validates against DB (mirrors `getCurrentUserFn` re-fetch). `POST /api/auth/logout` clears cookie.
- **Middleware**: `authenticate` (verify JWT, attach `req.user`) → `requireRole(roles)` (mirrors existing `requireRole` helper + `ROUTE_ACCESS`) → `schoolScope` (teacher approval/analytics authorization, mirrors `teacherSchoolIds`).
- **Protected routes**: enforcement on Express via the middleware chain; **frontend `middleware.ts`** mirrors `guardRedirect` (login redirect, wrong-role → `roleHome`, student pending funnel) for UX. `access.ts` remains the shared single source of truth, imported by both.

---

## D. Migration Roadmap (safest order)

1. **Stand up backend skeleton** alongside the existing app (Express + Mongoose + Mongo connection, health route). No existing files touched.
2. **Define Mongoose models + seed scripts** from `mock.ts`/`curriculum.ts`/`assessments.ts`. Verify data parity against current static content.
3. **Port pure logic first** (no I/O): `access.ts` RBAC, `gradeAssessment`, password hashing, `progress.ts` — shared lib consumed by backend.
4. **Implement JWT auth + middleware** (`authenticate`, `requireRole`, `schoolScope`); port auth + registration services/controllers; validate the four seed logins and the approval workflow end-to-end via API tests.
5. **Port remaining services** (analytics, certificates, forum) to Mongo-backed controllers; confirm responses match the old RPC outputs.
6. **Scaffold Next.js app**; port `__root.tsx` → `layout.tsx` + providers + `error`/`not-found`; add Axios client + React Query.
7. **Port shared UI** (`components/*`, sidebars, cards, `ForumView`, `LessonContentView`) — swap router imports only.
8. **Port routes surface-by-surface** behind the new Axios layer: public → auth → student → instructor → admin (one surface fully working before the next).
9. **Wire `middleware.ts`** for RBAC redirects; verify the student pending/approval funnel parity.
10. **Cutover & decommission**: point deploy at Next.js + Express; remove TanStack/Nitro/Cloudflare/Vite config, `routeTree.gen.ts`, `wrangler.toml`, `src/server.ts`/`src/start.ts`.

> Principle: backend reaches feature-parity behind a stable REST contract **before** the frontend rewrite, so the two efforts proceed independently and each surface is verifiable in isolation.

---

## E. Feature Inventory (modules to migrate)

**Frontend surfaces**
1. Public: home/marketing (`/`), course catalog (`/courses`), course detail (`/courses/:id`).
2. Auth: login, register (student registration form w/ school+teacher selection), forgot-password, email verify (`/verify/:token`).
3. Student: dashboard, curriculum, learn (`/learn/:id`), lesson (`/lesson/:lessonId`), quiz (`/quiz/:id`), assessment (`/assessment/:moduleId`), assignment (`/assignment/:id`), progress, certificate + certificates list, forum, pending/approval.
4. Instructor (teacher): dashboard, course create, approvals (registration decisions), analytics, forum.
5. Admin (school/platform): dashboard, analytics.

**Backend services / cross-cutting**
6. **Auth & session** — login/logout/me, JWT, password hashing, RBAC (`access.ts`).
7. **Registration & approval workflow (FR-01/FR-02)** — directory, create request, pending list (school-scoped), approve/reject, **notifications feed**.
8. **Analytics** — student snapshot sync; teacher/school/platform aggregations.
9. **Certificates** — issue, fetch (mine), public verify by token.
10. **Forum** — threads (search + paging), posts/replies, thread & post moderation (hide).
11. **Assessment engine** — definitions + `gradeAssessment` + pass threshold; best-attempt storage.
12. **Course/curriculum content** — courses/modules/lessons + curriculum + assignments (seed/static).
13. **Client course-engine state** — enrollment, progress, notes, reflections, time-spent, dark mode (to migrate from `localStorage` toward server-persisted as appropriate).
