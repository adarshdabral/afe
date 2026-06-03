# NEXTJS_MIGRATION_STATUS.md

Tracks execution of `MIGRATION_PLAN.md` (TanStack Start → Next.js App Router + Express/MongoDB/JWT).

**Baseline:** No application migration started. No target deps (`next`, `express`, `mongoose`, `jsonwebtoken`, `axios`) in `package.json`. No `web/`, `api/`, `middleware.ts`, or Axios client present. Source tree is unchanged TanStack Start.

**Design:** Target architecture designed in `TARGET_ARCHITECTURE.md` (folder structure, API structure, MongoDB schemas, JWT auth flow, migration order). Planning artifact only — no application code.

**Scaffold:** `frontend/` (Next.js App Router) and `backend/` (Express) trees created — directory structure, empty placeholder files, and config files only. No components/pages/business logic migrated.

**Auth migrated:** Authentication feature ported end-to-end — User model, JWT (sign/verify + httpOnly cookie), login/register/me/logout endpoints, `authenticate`/`requireRole` middleware, demo-user seed, and the frontend Axios auth service. Backend type-checks clean (`tsc` exit 0). Scope limited to auth; registration-approval workflow, analytics, certificates, forum untouched.

**Student Dashboard migrated:** `/student/dashboard` ported to Next.js App Router. Reused UI/Tailwind verbatim (`StudentSidebar`, `CourseCard`, `Button`, `categoryColor`, `cn`, `mock`, `assessments`); TanStack routing → `next/link`/`usePathname`/`next/navigation`; `AppContext` session block swapped from `createServerFn`+React Query to the Axios auth service. Root `layout.tsx` + `globals.css` (theme tokens) wired. Frontend type-checks clean (`tsc` exit 0).

**Instructor Dashboard migrated:** `/instructor/dashboard` ported to Next.js App Router. Reused UI/Tailwind verbatim (`InstructorSidebar`, `Button`, ui `Dialog`/`Input`/`Textarea`, `recharts` chart, `sonner` toasts, `mock` data); TanStack routing → `next/link`/`usePathname`. `<Toaster />` mounted in `layout.tsx`; `tw-animate-css` restored for dialog animations. Frontend type-checks clean (`tsc` exit 0).

**Admin Dashboard migrated:** `/admin/dashboard` ported to Next.js App Router. Reused UI/Tailwind verbatim (`AdminSidebar`, `Button`, ui `Dialog`/`Input`/`Textarea`, `recharts` bar chart, `sonner` toasts, `adminStats`); business logic reused via `useApp` approval/user actions (`approveInstructor`/`rejectCourse`/`suspendUser`/etc.); TanStack routing → `next/link`/`usePathname`. No new deps. Frontend type-checks clean (`tsc` exit 0).

**Courses migrated:** `/courses` (catalog) + `/courses/[id]` (detail) ported to Next.js App Router. Reused UI/Tailwind verbatim (`Navbar`, `CourseCard`, `CourseCardSkeleton`, ui `Input`/`Button`/`Checkbox`/`Accordion`, `mock` courses/reviews, `categoryColor`); business logic reused via `useApp` (`enroll`/`enrolledCourseIds`, `darkMode`). TanStack routing → `next/link`; detail route `loader`+`notFound` → `useParams`+`notFound()`; `useNavigate` → `useRouter().push`. New deps: `@radix-ui/react-accordion`, `@radix-ui/react-checkbox`. Frontend type-checks clean (`tsc` exit 0).

**Certificates migrated (full-stack):** First feature since auth with real `createServerFn` logic. **Backend** Express endpoints `POST /api/certificates/issue` (student, FR-11 eligibility re-validated via shared `buildCourseProgress`), `GET /api/certificates/mine` (student), `GET /api/certificates/verify/:token` (public) — backed by a Mongoose `Certificate` model (idempotent per student+course). Ported `progress.ts` (alias→relative) + `curriculum.ts`/`assessments.ts` into the backend. **Frontend** Axios service `lib/api/certificates.ts` replaces the 3 server-fn callables; pages `/student/certificates` (mock list), `/student/certificate` (auto-issue via Axios + `useEffect`), `/verify/[token]` (public). `CertificateCard`, `progress.ts`, `curriculum.ts` reused. Backend + frontend type-check clean (`tsc` exit 0).

**Bulk migration wave (Models, Student, Assessments, Instructor, Admin, Analytics, Forum, Auth UI):** Completed the remaining feature list in order.
- **MongoDB Models:** added `RegistrationRequest`, `Notification`, `AnalyticsSnapshot`, `ForumThread`, `ForumPost` (School/teacher directory kept as in-code constants; course Content stays frontend-static per plan §C / B4).
- **Backend suites:** Registration (`/api/registrations` — directory/create/mine/pending/decide + notifications, FR-01/02), Analytics (`/api/analytics` — progress sync + teacher/school/platform aggregates, FR-12, with seeded demo cohort), Forum (`/api/forum` — list/get/create/reply/moderate thread+post, FR-09, seeded). All Mongo-backed, idempotent seeds wired into `index.ts` startup. Backend `tsc` exit 0.
- **Frontend Axios services:** `registrations.ts`, `analytics.ts`, `forum.ts` replace the remaining `*.functions` callables.
- **Student module routes:** curriculum, learn/[id], lesson/[lessonId], assignment/[id], progress (Axios sync), pending (Axios poll), forum.
- **Assessments:** quiz/[id], assessment/[moduleId] (client-side `gradeAssessment`).
- **Instructor:** create, approvals (Axios), analytics (Axios), forum.
- **Admin:** analytics (Axios platform/school).
- **Components:** `ForumView` (RQ→Axios+useEffect), `LessonContentView`, ui `label`/`progress`/`switch`; hook `use-lesson-timer`; `roleLabel` helper.
- **Auth UI + shell:** `/login`, `/register` (FR-01 directory + registerStudent), `/forgot-password` (simulated), home `/`, `error.tsx`, `not-found.tsx`.
- Removed the empty `middleware.ts` placeholder (would break `next build`; RBAC middleware is a documented later step). **Frontend + backend `tsc` exit 0.** Original `src/` TanStack tree left intact (destructive cutover pending sign-off).

**Runtime Verification (live):** Booted an ephemeral MongoDB (`mongodb-memory-server`) and ran the real Express app against a scripted harness (`backend/verify/runtime-check.mts`) — **33/33 checks pass**:
- ✅ **All Express routes** — health, auth, registrations, analytics, certificates, forum exercised.
- ✅ **JWT login** — seed login sets `afe_session` cookie; `/auth/me` resolves with cookie, returns `null` without; bad password → 401; logout clears.
- ✅ **Registration flow** — public directory → student self-register (201, pending, cookie) → `/mine` shows pending+notification → teacher `/pending` lists it → teacher decide=approved → student `/auth/me` now `approved`.
- ✅ **Protected routes / RBAC** — no-auth → 401; wrong-role (student→teacher analytics, student→moderate, student→decide) → 403; correct role → 200.
- ✅ **MongoDB integration** — data persists across requests (register→read-back, create thread→reply→moderate, progress sync) against real Mongo.
- ✅ **Frontend API integrations** — Axios services (`auth/registrations/analytics/forum/certificates`) target the verified routes with matching method/path and `{data}` envelope; verified by `next build` type-checking the service↔page boundary (full browser E2E not run).
- ✅ **Production build** — `next build` exits clean: 22 static + dynamic routes generated, type validity checked; backend `tsc` exit 0.

**Issue found & fixed:** the registration→approval chain failed (teacher's pending list empty) because seeded users got Mongo `ObjectId`s while the teacher directory (`u-teacher`) and analytics cohort (`u-student`) referenced fixed string ids. **Fix:** restored string ids on `User` (`_id: String` + seeds set `_id: u-*`; registered users get `usr-<uuid>`) — re-ran harness: 33/33. Also set `eslint.ignoreDuringBuilds` in `next.config.ts` (the frontend was inheriting the legacy root repo's eslint+prettier flat config, failing the build on formatting-only rules; type safety still enforced by `tsc`/`next build`).

_Note (non-blocking): Express logs a `res.clearCookie maxAge` deprecation on logout (cosmetic; logout works)._

**Frontend RBAC (Part A):** Added `frontend/middleware.ts` guarding `/student/*`, `/instructor/*`, `/admin/*` (+ `/login`,`/register`). It validates the session via `GET /api/auth/me` (reusing the auth service, mirroring the old TanStack `beforeLoad` guard) and applies the canonical `guardRedirect` from the new `frontend/lib/access.ts` (byte-identical to `backend/src/shared/access.ts`). Express RBAC untouched — middleware is the UX layer; the API remains the authority. **Verified:** RBAC redirect matrix **21/21** (`backend/verify/rbac-check.mts`); live HTTP E2E **12/12** (`backend/verify/middleware-e2e.mts`, real `next start` + Express): anon→/login, wrong-role→own home, authed-on-/login→home, allowed→200. (A flaky first run was my harness orphaning `next-server` on :3000 — fixed with process-group kill + port sweep.)

**Final Cutover (Part B):** Decommissioned the legacy TanStack app. **Snapshot → `legacy-backup/`** (rollback): `src/` (incl. `routeTree.gen.ts`, `server.ts`/`start.ts`, all `*.functions.ts` createServerFn infra), `vite.config.ts` (Nitro via the lovable wrapper), `wrangler.toml`, `eslint.config.js`, `components.json`, `bunfig.toml`, `.prettierrc`/`.prettierignore`, root `package.json`/`bun.lock`/`package-lock.json`/`tsconfig.json`. **Deleted** (reproducible): `dist/`, orphaned root `node_modules/`, `.tanstack/`, `.wrangler/`. Left untouched (not confirmed-unused): `.vercel/`, `.github/`, `.lovable/`, docs. **Issue found & fixed:** the cutover exposed `canvas-confetti` being resolved parasitically from the root `node_modules` — added it (+`@types/canvas-confetti`) to `frontend/package.json` so the frontend is truly self-contained.

**Final verification:** `next build` exit 0 (22 pages + Middleware) · backend `tsc` exit 0 · dependency audit (`depcheck`) backend clean, frontend only false positives (CSS `@import` + build tooling) · zero references to deleted TanStack files from `frontend/`+`backend/`.

**Post-migration feature changes (institution branding + role signup):**
- **Staff identity** → all instructor/admin display names set to **"Dr Sudhanshu Joshi"**: backend seeds (teacher/school_admin/platform_admin), teacher directory (`registration.service.ts`), forum seed author, and frontend `mock.ts` (course instructors `+` initials `SJ`, qna answers, pending courses, admin user table), plus sidebar fallbacks + instructor dashboard welcome.
- **Global footer** — new `frontend/components/Footer.tsx` ("Developed by : Centre of Excellence in Logistics & Supply Chain Management, Doon University under financial aid by UCOST, Government of Uttarakhand") rendered app-wide via `app/layout.tsx`.
- **Role selection at signup** — register page now has an "I am a" role select (Student / Teacher / School Admin / Platform Admin). Students keep the school-linked teacher-approval flow (`/api/registrations`); staff roles create an active account via the new `POST /api/auth/signup` (`createUser` service, `signup` controller) → redirected to their role home. Frontend `lib/api/auth.ts` gains `signup()`.
- **Admin credentials** — platform_admin seed username is now **`Moocs@admin`** (password `Admin@123`, unchanged email `admin@afe.edu` still valid).
- **Verified:** new `backend/verify/feature-check.mts` **9/9** (Moocs@admin login, names, teacher/admin signup + login, duplicate-identifier 409); regression: runtime **33/33**, RBAC **21/21**; backend+frontend `tsc` 0; `next build` green.
- _Note: role selection allows self-registering as platform_admin/school_admin (per request). For production, consider gating staff signup behind an invite/approval — flagged, not changed._

_Last updated: post-migration feature changes (staff name, footer, role signup, Moocs@admin) — verified._

_Last updated: runtime verification complete — 33/33 live API checks + production build green._

---

## Roadmap Progress (per MIGRATION_PLAN.md §D)

| # | Step | Status |
|---|------|--------|
| 1 | Backend skeleton (Express + Mongoose + Mongo) | ✅ Done (bootstrap, db, CORS, error handler, health) |
| 2 | Mongoose models + seed scripts | ✅ Done (User, Certificate, RegistrationRequest, Notification, AnalyticsSnapshot, ForumThread, ForumPost; +seeds. Content stays static) |
| 3 | Port pure logic (`access.ts`, `gradeAssessment`, hashing, `progress.ts`) | ✅ Done (access, hashing, progress; gradeAssessment via assessments.ts) |
| 4 | JWT auth + middleware; port auth + registration | ✅ Done (auth + registration/approval workflow + notifications) |
| 5 | Port analytics, certificates, forum services | ✅ Done (certificates, analytics, forum) |
| 6 | Scaffold Next.js; `__root.tsx` → `layout.tsx`; Axios + React Query | 🟦 In progress (layout/Toaster/error/not-found done; React Query provider intentionally omitted — Axios+useEffect used instead) |
| 7 | Port shared UI (`components/*`, sidebars, cards) | ✅ Done (3 sidebars, Navbar, CourseCard(+Skeleton), CertificateCard, ForumView, LessonContentView, all needed ui) |
| 8 | Port routes surface-by-surface | ✅ Done (public, auth, student, instructor, admin — 26 pages) |
| 9 | Wire `middleware.ts` RBAC redirects | ✅ Done (`middleware.ts` + `lib/access.ts`; matrix 21/21, live E2E 12/12) |
| 10 | Cutover & decommission TanStack/Nitro/Cloudflare | ✅ Done (legacy → `legacy-backup/`; build artifacts deleted; `next build`/`tsc` green) |

Legend: ⬜ Pending · 🟦 In progress · ✅ Done · ⛔ Blocked

---

## Completed Tasks
- [x] Migration plan authored (`MIGRATION_PLAN.md`)
- [x] Status tracker established (`NEXTJS_MIGRATION_STATUS.md`)
- [x] Target architecture designed (`TARGET_ARCHITECTURE.md`) — folder structure, API map, Mongoose schemas, JWT auth flow, migration order
- [x] `frontend/` + `backend/` scaffold — empty files + config files (no logic)
- [x] **Authentication feature** — User model, JWT, login/register/me/logout, middleware, demo seed, frontend auth service (`tsc` clean)
- [x] **Student Dashboard** (`/student/dashboard`) — page + dependency closure (sidebar, course card, button, mock/assessments data, AppContext); `tsc` clean
- [x] **Instructor Dashboard** (`/instructor/dashboard`) — page + InstructorSidebar + ui Dialog/Input/Textarea + recharts + sonner Toaster; `tsc` clean
- [x] **Admin Dashboard** (`/admin/dashboard`) — page + AdminSidebar; reused `useApp` approval/user actions, recharts, existing ui; no new deps; `tsc` clean
- [x] **Courses** (`/courses` + `/courses/[id]`) — catalog + detail; Navbar, CourseCardSkeleton, ui Checkbox/Accordion; `notFound()` + `useParams`; `tsc` clean
- [x] **Certificates** (full-stack) — backend issue/mine/verify endpoints + `Certificate` model; frontend Axios service + `/student/certificates`, `/student/certificate`, `/verify/[token]`; reused `buildCourseProgress`/`CertificateCard`; `tsc` clean (BE+FE)
- [x] **MongoDB Models** — RegistrationRequest, Notification, AnalyticsSnapshot, ForumThread, ForumPost (+ idempotent seeds)
- [x] **Registration/approval** (FR-01/02) — backend `/api/registrations` (directory/create/mine/pending/decide + notifications); frontend `registrations.ts`
- [x] **Analytics** (FR-12) — backend `/api/analytics` (progress sync + teacher/school/platform aggregates, seeded cohort); frontend `analytics.ts`
- [x] **Forum** (FR-09) — backend `/api/forum` (list/get/create/reply/moderate); frontend `forum.ts` + `ForumView` (RQ→Axios)
- [x] **Student module** — curriculum, learn/[id], lesson/[lessonId], quiz/[id], assessment/[moduleId], assignment/[id], progress, pending, forum
- [x] **Assessments** — quiz + assessment routes (client-side `gradeAssessment`)
- [x] **Instructor module** — create, approvals, analytics, forum
- [x] **Admin module** — analytics
- [x] **Auth UI + shell** — `/login`, `/register`, `/forgot-password`, home `/`, `error.tsx`, `not-found.tsx`
- [x] Shared: `LessonContentView`, `ForumView`, ui `label`/`progress`/`switch`, hook `use-lesson-timer`, `roleLabel`
- [x] **Runtime verification** — 33/33 live API checks + `next build` green
- [x] **Frontend RBAC** — `middleware.ts` + `lib/access.ts`; matrix 21/21, live E2E 12/12
- [x] **Final cutover** — legacy → `legacy-backup/`; build artifacts removed; `next build`/BE `tsc` green; `canvas-confetti` self-contained

---

## Pending Tasks

**Backend** — ✅ all endpoints ported (auth, registration, analytics, certificates, forum); models + idempotent seeds wired; `schoolScope` enforced inside registration/analytics services + `requireRole`. Backend `tsc` exit 0.

**Frontend** — ✅ 26 App Router pages (public/auth/student/instructor/admin), all components + ui, 5 Axios services, AppContext. Frontend `tsc` exit 0.

**Remaining:**
- [x] `middleware.ts` RBAC redirects (mirror `guardRedirect`) — _done; validates via `/api/auth/me`, matrix 21/21 + live E2E 12/12._
- [ ] React Query provider — _intentionally not added; migration uses Axios + `useEffect`. The shared `["currentUser"]` cache the old root guard seeded is not wired; `AppContext` fetches the session once on mount. (Design choice, not a defect.)_
- [x] Live run verification — _33/33 API checks + `next build` green._
- [ ] Browser UI click-through E2E — _still not run (API + middleware verified at HTTP level; no headless-browser driver)._

**Cutover:**
- [x] Decommissioned TanStack/Nitro/Vite/Cloudflare + `routeTree.gen.ts` + `wrangler.toml` + `src/server.ts`/`src/start.ts` + the whole `src/` tree → moved to `legacy-backup/` (rollback snapshot); build artifacts deleted. `next build` + backend `tsc` green afterward.

---

## Blockers

| # | Blocker | Needs decision | Impacts |
|---|---------|----------------|---------|
| B1 | ~~JWT transport~~ — **resolved**: `httpOnly` cookie `afe_session` (Bearer header also accepted by `authenticate`) | — | Closed |
| B2 | ~~Storage target~~ — **resolved**: MongoDB/Mongoose used throughout (all stores ported Map→Mongoose) | — | Closed |
| B3 | Live verification done via ephemeral `mongodb-memory-server` (33/33). Still need a real `MONGODB_URI` + `JWT_SECRET` for actual deployment | Env/credentials from user | Deployment only |
| B4 | ~~Content static vs DB~~ — **resolved**: course/curriculum/assessment content kept frontend-static (also copied to backend for cert eligibility); not seeded to DB | — | Closed |

---

## Files Migrated

| Source (TanStack) | Target | Action | Status |
|-------------------|--------|--------|--------|
| `src/lib/auth/access.ts` | `backend/src/shared/access.ts` | Reused verbatim (RBAC) | ✅ |
| `src/lib/auth/session.server.ts` (PBKDF2) | `backend/src/utils/password.ts` | Moved verbatim (hashing) | ✅ |
| `src/lib/auth/users.server.ts` | `backend/src/models/User.ts` + `services/auth.service.ts` | Ported (Map → Mongoose) | ✅ |
| `src/lib/auth/users.server.ts` (seed list) | `backend/src/seed/users.seed.ts` | Ported (idempotent seed) | ✅ |
| `src/lib/auth/auth.functions.ts` | `backend/src/controllers/auth.controller.ts` + `routes/auth.routes.ts` | Ported (RPC → REST + JWT) | ✅ |
| `src/lib/auth/auth.functions.ts` (client callables) | `frontend/lib/api/auth.ts` + `lib/api/axios.ts` | Ported (createServerFn → Axios) | ✅ |
| `src/routes/student.dashboard.tsx` | `frontend/app/student/dashboard/page.tsx` | Ported (createFileRoute → page; Link → next/link) | ✅ |
| `src/components/StudentSidebar.tsx` | `frontend/components/StudentSidebar.tsx` | Ported (TanStack Link/useRouterState → next) | ✅ |
| `src/components/CourseCard.tsx` | `frontend/components/CourseCard.tsx` | Ported (TanStack Link → next/link) | ✅ |
| `src/components/ui/button.tsx` | `frontend/components/ui/button.tsx` | Reused verbatim | ✅ |
| `src/lib/utils.ts` (`cn`) | `frontend/lib/utils.ts` | Reused verbatim | ✅ |
| `src/lib/categoryColor.ts` | `frontend/lib/categoryColor.ts` | Reused verbatim | ✅ |
| `src/data/mock.ts` | `frontend/data/mock.ts` | Moved verbatim | ✅ |
| `src/data/assessments.ts` | `frontend/data/assessments.ts` | Moved verbatim | ✅ |
| `src/context/AppContext.tsx` | `frontend/context/AppContext.tsx` | Ported (RQ/TanStack router → Axios + next/navigation) | ✅ |
| `src/styles.css` (theme tokens) | `frontend/app/globals.css` | Moved (dropped `@source`/tw-animate import) | ✅ |
| `src/routes/__root.tsx` (shell/providers) | `frontend/app/layout.tsx` | Ported (AppProvider + metadata + Toaster) | 🟦 partial |
| `src/routes/instructor.dashboard.tsx` | `frontend/app/instructor/dashboard/page.tsx` | Ported (createFileRoute → page; Link → next/link) | ✅ |
| `src/components/InstructorSidebar.tsx` | `frontend/components/InstructorSidebar.tsx` | Ported (TanStack Link/useRouterState → next) | ✅ |
| `src/components/ui/dialog.tsx` | `frontend/components/ui/dialog.tsx` | Reused verbatim | ✅ |
| `src/components/ui/input.tsx` | `frontend/components/ui/input.tsx` | Reused verbatim | ✅ |
| `src/components/ui/textarea.tsx` | `frontend/components/ui/textarea.tsx` | Reused verbatim | ✅ |
| `src/routes/admin.dashboard.tsx` | `frontend/app/admin/dashboard/page.tsx` | Ported (createFileRoute → page; dropped unused Link) | ✅ |
| `src/components/AdminSidebar.tsx` | `frontend/components/AdminSidebar.tsx` | Ported (TanStack Link/useRouterState → next) | ✅ |
| `src/routes/courses.tsx` | `frontend/app/courses/page.tsx` | Ported (createFileRoute → page; Link → next/link) | ✅ |
| `src/routes/courses.$id.tsx` | `frontend/app/courses/[id]/page.tsx` | Ported (loader/notFound → useParams/notFound; useNavigate → useRouter) | ✅ |
| `src/components/Navbar.tsx` | `frontend/components/Navbar.tsx` | Ported (TanStack Link → next/link) | ✅ |
| `src/components/CourseCardSkeleton.tsx` | `frontend/components/CourseCardSkeleton.tsx` | Moved verbatim | ✅ |
| `src/components/ui/checkbox.tsx` | `frontend/components/ui/checkbox.tsx` | Reused verbatim | ✅ |
| `src/components/ui/accordion.tsx` | `frontend/components/ui/accordion.tsx` | Reused verbatim | ✅ |
| `src/lib/certificates/certificates.server.ts` | `backend/src/models/Certificate.ts` + `services/certificate.service.ts` | Ported (Map → Mongoose, idempotent) | ✅ |
| `src/lib/certificates/certificate.functions.ts` | `backend/src/controllers/certificate.controller.ts` + `routes/certificate.routes.ts` | Ported (RPC → REST; eligibility re-validated) | ✅ |
| `src/lib/certificates/certificate.functions.ts` (callables) | `frontend/lib/api/certificates.ts` | Ported (createServerFn → Axios) | ✅ |
| `src/lib/progress.ts` | `backend/src/lib/progress.ts` + `frontend/lib/progress.ts` | Ported (BE alias→relative; FE verbatim) | ✅ |
| `src/data/curriculum.ts` | `backend/src/data/curriculum.ts` + `frontend/data/curriculum.ts` | Moved verbatim | ✅ |
| `src/data/assessments.ts` | `backend/src/data/assessments.ts` | Moved verbatim (FE copy already present) | ✅ |
| `src/routes/student.certificates.tsx` | `frontend/app/student/certificates/page.tsx` | Ported (Link → next/link) | ✅ |
| `src/routes/student.certificate.tsx` | `frontend/app/student/certificate/page.tsx` | Ported (RQ/server-fn → Axios + useEffect) | ✅ |
| `src/routes/verify.$token.tsx` | `frontend/app/(auth)/verify/[token]/page.tsx` | Ported (loader → useParams + Axios) | ✅ |
| `src/components/CertificateCard.tsx` | `frontend/components/CertificateCard.tsx` | Reused verbatim | ✅ |
| `src/lib/auth/registrations.server.ts` | `backend/src/models/{RegistrationRequest,Notification,School}.ts` + `services/registration.service.ts` | Ported (Map → Mongoose; directory as constants) | ✅ |
| `src/lib/auth/registration.functions.ts` | `backend/src/controllers/registration.controller.ts` + `routes/registration.routes.ts` | Ported (RPC → REST; create issues JWT) | ✅ |
| `src/lib/analytics/analytics.server.ts` | `backend/src/models/AnalyticsSnapshot.ts` + `services/analytics.service.ts` + `seed/analytics.seed.ts` | Ported (Map → Mongoose; aggregations preserved; cohort seeded) | ✅ |
| `src/lib/analytics/analytics.functions.ts` | `backend/src/controllers/analytics.controller.ts` + `routes/analytics.routes.ts` | Ported (RPC → REST) | ✅ |
| `src/lib/forum/forum.server.ts` | `backend/src/models/{ForumThread,ForumPost}.ts` + `services/forum.service.ts` + `seed/forum.seed.ts` | Ported (Map → Mongoose; staff visibility preserved; seeded) | ✅ |
| `src/lib/forum/forum.functions.ts` | `backend/src/controllers/forum.controller.ts` + `routes/forum.routes.ts` | Ported (RPC → REST) | ✅ |
| `*.functions.ts` (client callables) | `frontend/lib/api/{registrations,analytics,forum}.ts` | Ported (createServerFn → Axios) | ✅ |
| `src/routes/student.{curriculum,learn.$id,lesson.$lessonId,quiz.$id,assessment.$moduleId,assignment.$id,progress,pending,forum}.tsx` | `frontend/app/student/*` (9 pages) | Ported (server-fns → Axios; RQ → useEffect) | ✅ |
| `src/routes/instructor.{create,approvals,analytics,forum}.tsx` | `frontend/app/instructor/*` (4 pages) | Ported (server-fns → Axios; RQ → useEffect) | ✅ |
| `src/routes/admin.analytics.tsx` | `frontend/app/admin/analytics/page.tsx` | Ported (analytics fns → Axios) | ✅ |
| `src/routes/{index,login,register,forgot-password}.tsx` | `frontend/app/page.tsx` + `app/(auth)/*` | Ported (auth/registration fns → Axios; role-based redirect) | ✅ |
| `src/routes/__root.tsx` (error/404) | `frontend/app/error.tsx` + `not-found.tsx` | Ported | ✅ |
| `src/components/{ForumView,LessonContentView}.tsx` | `frontend/components/*` | Ported (ForumView RQ→Axios; LessonContentView "use client") | ✅ |
| `src/components/ui/{label,progress,switch}.tsx` | `frontend/components/ui/*` | Reused verbatim | ✅ |
| `src/hooks/use-lesson-timer.ts` | `frontend/hooks/use-lesson-timer.ts` | Moved verbatim | ✅ |

New backend infra (no TanStack source): `config/env.ts`, `config/db.ts`, `utils/jwt.ts`, `utils/asyncHandler.ts`, `middleware/authenticate.ts`, `types/express.d.ts`, `index.ts`.

> Prefer **moving** over rewriting: `access.ts` and PBKDF2 hashing moved verbatim; user store ported Map→Mongoose preserving the timing-safe auth behaviour. Remaining `gradeAssessment`, `progress.ts`, `components/*`, `src/data/*` to be reused in later features.
