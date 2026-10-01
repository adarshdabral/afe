# TARGET_ARCHITECTURE.md

Target design for the Next.js + Express/MongoDB/JWT migration. Derived from `MIGRATION_PLAN.md`. Design only — no code.

---

## 1. Folder Structure

Monorepo with two deployables (`web/` Next.js, `api/` Express) and a shared package.

```
ai-spark/
├── web/                              # Next.js App Router (TypeScript, Tailwind, Axios)
│   ├── app/
│   │   ├── layout.tsx                # ← src/routes/__root.tsx (providers + shell)
│   │   ├── error.tsx  not-found.tsx
│   │   ├── page.tsx                  # /
│   │   ├── courses/page.tsx
│   │   ├── courses/[id]/page.tsx
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/register/page.tsx
│   │   ├── (auth)/forgot-password/page.tsx
│   │   ├── (auth)/verify/[token]/page.tsx
│   │   ├── student/
│   │   │   ├── dashboard|curriculum|progress|certificates|forum|pending/page.tsx
│   │   │   ├── certificate/page.tsx
│   │   │   ├── learn/[id]/page.tsx
│   │   │   ├── lesson/[lessonId]/page.tsx
│   │   │   ├── quiz/[id]/page.tsx
│   │   │   ├── assessment/[moduleId]/page.tsx
│   │   │   └── assignment/[id]/page.tsx
│   │   ├── instructor/(dashboard|create|approvals|analytics|forum)/page.tsx
│   │   └── admin/(dashboard|analytics)/page.tsx
│   ├── components/                   # ← src/components/* (moved, router imports swapped)
│   ├── context/                      # ← src/context/AppContext.tsx (Axios-backed)
│   ├── hooks/                        # ← src/hooks/*
│   ├── lib/
│   │   ├── api/                      # axios instance + typed endpoint clients (replaces *.functions.ts callables)
│   │   ├── utils.ts categoryColor.ts progress.ts   # ← moved
│   │   └── styles/                   # ← src/styles.css
│   ├── middleware.ts                 # edge RBAC redirect (imports shared access rules)
│   ├── next.config.ts  tailwind/postcss  tsconfig.json
│
├── api/                              # Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts                  # bootstrap: cors, cookie-parser, json, routes, error handler
│   │   ├── config/db.ts env.ts
│   │   ├── models/                   # Mongoose schemas (§3)
│   │   ├── routes/                   # auth, registrations, analytics, certificates, forum, content
│   │   ├── controllers/              # ← *.functions.ts handler bodies
│   │   ├── services/                 # ← *.server.ts logic (Mongo-backed)
│   │   ├── middleware/               # authenticate, requireRole, schoolScope, validate(zod), errorHandler
│   │   ├── utils/                    # password hashing (← session.server.ts), jwt
│   │   └── seed/                     # ← src/data/* → DB
│   └── tsconfig.json
│
└── packages/shared/                 # isomorphic, imported by web + api
    ├── access.ts                     # ← src/lib/auth/access.ts (RBAC: ROUTE_ACCESS, guardRedirect, roleHome)
    ├── assessments.ts                # ← src/data/assessments.ts (gradeAssessment, PASS_PERCENTAGE)
    └── types.ts                      # shared DTOs (← mock.ts / *.server.ts interfaces)
```

Reuse note: `components/*`, `hooks/*`, `data/*`, `utils.ts`, `progress.ts`, `access.ts`, `assessments.ts`, password hashing are **moved**, not rewritten.

---

## 2. API Structure

Base: `/api`. Auth via JWT (see §4). All mutating inputs validated with the **reused zod schemas** from the `*.functions.ts` validators.

| Method | Path | Source RPC | Access |
|--------|------|-----------|--------|
| POST | `/api/auth/login` | `loginFn` | public |
| POST | `/api/auth/logout` | `logoutFn` | auth |
| GET | `/api/auth/me` | `getCurrentUserFn` | auth |
| GET | `/api/registrations/directory` | `getRegistrationDirectoryFn` | public |
| POST | `/api/registrations` | `registerStudentFn` | public |
| GET | `/api/registrations/mine` | `myRegistrationFn` | student |
| GET | `/api/registrations/pending` | `pendingRegistrationsFn` | teacher (school-scoped) |
| POST | `/api/registrations/:id/decide` | `decideRegistrationFn` | teacher (school-scoped) |
| POST | `/api/analytics/progress` | `syncMyProgressFn` | student |
| GET | `/api/analytics/teacher` | `teacherAnalyticsFn` | teacher |
| GET | `/api/analytics/school` | `schoolAnalyticsFn` | school_admin / platform_admin |
| GET | `/api/analytics/platform` | `platformAnalyticsFn` | platform_admin |
| POST | `/api/certificates/issue` | `issueCertificateFn` | student |
| GET | `/api/certificates/mine` | `myCertificateFn` | student |
| GET | `/api/certificates/verify/:token` | `verifyCertificateFn` | public |
| GET | `/api/forum/threads` | `listThreadsFn` | auth |
| GET | `/api/forum/threads/:id` | `getThreadFn` | auth |
| POST | `/api/forum/threads` | `createThreadFn` | auth |
| POST | `/api/forum/threads/:id/replies` | `replyFn` | auth |
| POST | `/api/forum/threads/:id/moderate` | `moderateThreadFn` | teacher/admin |
| POST | `/api/forum/posts/:id/moderate` | `moderatePostFn` | teacher/admin |
| GET | `/api/content/*` | `src/data/*` | public (if not kept static in `web/`) |

Response envelope: `{ data }` on success, `{ error: { message } }` on failure (mirrors current thrown-`Error` messages). Middleware chain per route: `authenticate → requireRole(...) → schoolScope? → validate(zod) → controller`.

---

## 3. MongoDB Schemas (Mongoose)

Field lists only; each maps from an existing in-memory store.

- **User** ← `users.server.ts` — `role` (enum: student|teacher|school_admin|platform_admin), `name`, `email` (unique sparse), `username` (unique sparse), `mobile` (unique sparse), `passwordHash`, `registrationStatus` (students: pending|approved|rejected), `schoolIds` (teachers). Indexes: lowercased login identifiers (email/username/mobile).
- **School** ← `registrations.server.ts` `SCHOOLS` — `name`.
- **TeacherDirectory** ← `TEACHERS` — `userId` (→ User), `name`, `schoolId` (→ School). (Or embed `schoolIds` on teacher User; directory kept for school-scoped lookup.)
- **RegistrationRequest** ← `registrations.server.ts` — `studentUserId`, `studentName`, `className`, `rollNumber`, `schoolId`, `schoolName`, `teacherId`, `teacherName`, `email`, `mobile`, `status`, `requestedAt`, `decidedAt?`, `decidedBy?`, `reason?`. Index: `{ status, schoolId }`.
- **Notification** ← `registrations.server.ts` — `userId`, `type` (registration_pending|approved|rejected), `message`, `read`, `createdAt`.
- **Certificate** ← `certificates.server.ts` — `studentUserId`, `courseId`, `studentName`, `courseTitle`, `schoolName?`, `token` (unique), `issuedAt`. Index: `{ studentUserId, courseId }` unique.
- **AnalyticsSnapshot** ← `analytics.server.ts` `StudentSnapshot` — `studentUserId`, `schoolId`, `className`, progress/score/time fields, `updatedAt`. Index: `{ schoolId, className }`.
- **ForumThread** ← `forum.server.ts` — `title`, `authorId`, `authorRole`, `body`, `hidden`, `createdAt`.
- **ForumPost** ← `forum.server.ts` — `threadId`, `authorId`, `authorRole`, `body`, `hidden`, `createdAt`.
- **Content** (Course/Module/Lesson, Assessment) ← `mock.ts`/`curriculum.ts`/`assessments.ts` — seeded read-only; **may remain frontend-static** if never mutated (see Blocker B4).

---

## 4. Auth Flow (JWT)

Decision pending (Blocker B1): default below assumes **`httpOnly` cookie** for parity with the current sealed cookie.

1. **Login** — `POST /api/auth/login` with `{ login, password }` → `services/auth` looks up by lowercased email/username/mobile → verify with **reused PBKDF2 `verifyPassword`** (unknown-login dummy-hash timing guard preserved) → sign JWT `{ sub, role, registrationStatus }` (short-lived) → set `httpOnly`, `sameSite=lax`, `secure` in prod cookie `afe_session`.
2. **Session resolve** — `GET /api/auth/me` → `authenticate` verifies JWT → re-fetch principal from DB (mirrors `getCurrentUserFn` revalidation so suspended/stale accounts can't ride an old token) → returns principal or 401.
3. **Logout** — `POST /api/auth/logout` clears the cookie.
4. **Registration** — `POST /api/registrations` creates a `pending` student + request + notification, then issues a session (mirrors `createRegistration`).
5. **Enforcement (backend)** — `authenticate → requireRole(ROUTE_ACCESS roles) → schoolScope` (teacher actions limited to their `schoolIds`, mirroring `teacherSchoolIds`).
6. **Enforcement (frontend)** — `web/middleware.ts` mirrors **`guardRedirect`** from shared `access.ts`: unauthenticated→`/login`, wrong role→`roleHome`, student-not-approved→`/student/pending`. UX-only; the API is the authority.

`access.ts` stays the single source of truth, imported by both `web` and `api` from `packages/shared`.

---

## 5. Migration Order

Follows `MIGRATION_PLAN.md §D`; collapsed to design-stage checkpoints.

1. Extract `packages/shared` (`access.ts`, `assessments.ts`, DTO types) — pure moves.
2. `api/` skeleton: Express + Mongo connect + health + env/config.
3. Mongoose models (§3) + seed from `src/data/`; verify parity.
4. JWT utils + middleware (`authenticate`, `requireRole`, `schoolScope`, `validate`); reuse password hashing.
5. Port **auth + registration** services/controllers; verify 4 seed logins + approval workflow.
6. Port **analytics, certificates, forum** services/controllers; match old RPC outputs.
7. `web/` scaffold: `app/layout.tsx` (← `__root.tsx`), `error`/`not-found`, Axios client, React Query.
8. Move shared UI (`components/*`, sidebars, cards, `ForumView`, `LessonContentView`) — swap router imports only.
9. Port `AppContext` to Axios-backed; `["currentUser"]` → `/api/auth/me`.
10. Port routes surface-by-surface: public → auth → student → instructor → admin.
11. `web/middleware.ts` RBAC redirects; verify pending/approval funnel parity.
12. Cutover deploy; decommission TanStack/Nitro/Vite/Cloudflare config, `routeTree.gen.ts`, `wrangler.toml`, `src/server.ts`/`src/start.ts`.

Gating: resolve B1 (JWT transport) before step 4, B2 (Mongo authoritative) before step 3, B4 (content static vs seeded) before step 3.
