# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A MOOC / online-learning platform ("ai-spark" / "AI For Everyone") built with **TanStack Start** (full-stack React + SSR), React 19, Tailwind v4, and shadcn/ui. Originally a Lovable-generated UI; it now has a **real server-side auth layer** (sealed-cookie sessions, PBKDF2 password hashing, RBAC route guard) implemented against the SRS in `src/lib/auth/`.

The data model is **hybrid**:
- **Real, server-side**: authentication, student registration/approval, and the analytics/certificates/forum RPC surfaces — backed by an **in-memory store** (`*.server.ts`) that is the explicit seam to a future Postgres DB.
- **Mock, client-side**: course/lesson/quiz content and most session UI state, in `src/data/mock.ts` + `src/context/AppContext.tsx`, persisted to `localStorage` under `afe.*` keys.

## Commands

This project uses **Bun** (`bun.lock`, `bunfig.toml`). The untracked `package-lock.json` is incidental — prefer `bun install`.

```bash
bun install          # install deps (respects bunfig.toml 24h supply-chain guard)
bun run dev          # vite dev server
bun run build        # production build (Nitro → Cloudflare target by default)
bun run build:dev    # build in development mode
bun run preview      # preview the production build
bun run lint         # eslint .
bun run format       # prettier --write .
```

There is **no test framework** configured.


## Architecture

### TanStack Start, not Next.js/Remix
This is a common source of mistakes. See `src/routes/README.md` for the full routing table. Key points:
- **File-based routing** in `src/routes/`. `routeTree.gen.ts` is auto-generated — never edit by hand (it shows as modified in git because the generator rewrites it).
- Routes use **dot-separated filenames** for nested paths: `student.dashboard.tsx` → `/student/dashboard`, `courses.$id.tsx` → `/courses/:id`. Dynamic segments use a bare `$` (no curly braces).
- `src/routes/__root.tsx` is the only app shell — it mounts the `QueryClientProvider`, `AppProvider`, `Toaster`, and the root 404 / error boundaries. Preserve `<Outlet />`.
- Do **not** create `src/pages/`, `app/layout.tsx`, or use the Next.js `server-only` package — eslint blocks the last one.

### Build config is wrapped — don't duplicate plugins
`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which **already includes** `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, `nitro`, the `@` path alias, error-logger plugins, and `VITE_*` env injection. Adding any of these manually breaks the app with duplicate plugins. Pass extra config through `defineConfig({ vite: { ... } })`.

### Server logic & env vars
Server entry is redirected to `src/server.ts` (an SSR error wrapper that normalizes h3's swallowed 500s into a rendered error page); `src/start.ts` adds request middleware. The codebase follows a consistent **two-file pattern** per feature (see `src/lib/auth/`, `analytics/`, `certificates/`, `forum/`):
- **`*.functions.ts`** — the RPC surface. Each export is a **`createServerFn`** whose `.handler` body is server-only and tree-shaken from the client bundle; the client keeps only the typed callable. Inputs are validated with `zod` via `.inputValidator(...)`. This is the way to expose server logic — not separate edge functions. (`src/lib/api/example.functions.ts` is the minimal reference.)
- **`*.server.ts`** — server-only implementation/state (the in-memory store, session helpers, secrets). The suffix keeps it (and anything it imports, e.g. `SESSION_SECRET`) out of the client bundle.
- On the Cloudflare Workers target, env binds **per-request**: read `process.env` *inside* a function/handler, never at module scope (see `sessionPassword()` in `session.server.ts`). Public config uses the `VITE_` prefix via `import.meta.env` (ships to the browser — no secrets).
- Env vars: `SESSION_SECRET` (≥32 chars; **required in production**, dev has an insecure fallback). Seed account passwords are overridable via `SEED_STUDENT_PASSWORD` / `SEED_TEACHER_PASSWORD` / `SEED_SCHOOL_ADMIN_PASSWORD` / `SEED_PLATFORM_ADMIN_PASSWORD`.

### Auth & RBAC
- **Roles** (`src/lib/auth/access.ts`, isomorphic — safe to import anywhere): `student`, `teacher`, `school_admin`, `platform_admin`. The UI only ships three surfaces, so roles are mapped on: teacher → `/instructor`, school_admin & platform_admin → `/admin`, student → `/student`. `access.ts` is the single source of truth for the route→roles map (`ROUTE_ACCESS`), `roleHome`, and the pure `guardRedirect` decision.
- **The single gate** is `beforeLoad` in `src/routes/__root.tsx`: it resolves the current user once (cached under React Query key `["currentUser"]`), then calls `guardRedirect`. This protects every `/student`, `/instructor`, `/admin` route — don't add ad-hoc per-route guards.
- **Student approval (FR-01/FR-02)**: new students start `registrationStatus: "pending"`; until a teacher approves, every `/student/*` route funnels to `/student/pending`. This logic lives in `guardRedirect`.
- **Passwords**: PBKDF2-HMAC-SHA256 via Web Crypto (`session.server.ts`) — works on Node and Workers without native bcrypt/argon2. Sessions are sealed `httpOnly` cookies (`afe_session`) via `useAppSession()`. The user store (`users.server.ts`) is in-memory with seeded demo accounts (`student@afe.edu` / `Student@123`, etc.) and is the documented swap-point for Postgres.

### State & data
- Course/lesson/quiz content + admin/instructor mock entities are in `src/data/mock.ts`; assessment definitions/results types are in `src/data/assessments.ts`.
- `AppContext` (`useApp()`) holds two things: (1) the **session identity** — `authUser`, `role`, `isAuthenticated`, `logout` — sourced from `getCurrentUserFn` under the same `["currentUser"]` query key the root guard seeds; and (2) **client UI/course-engine state** — enrollment, progress, notes, reflections, `assessmentScores`, `timeSpent`, dark mode, and the admin approval queues. Note `currentUser` (mock, course/enrollment data) is distinct from `authUser` (real session identity).
- `localStorage` (`afe.*` keys) persists: `darkMode`, `notes`, `completedLessons`, `reflections`, `assessmentScores`, `timeSpent`.
- The three surfaces — student, instructor, admin — each have a sidebar (`StudentSidebar`, `InstructorSidebar`, `AdminSidebar`) and their own routes (`student.*`, `instructor.*`, `admin.*`).

### UI conventions
- shadcn/ui ("new-york" stylex) in `src/components/ui/`; configured via `components.json`. Add components with the shadcn CLI rather than hand-writing.
- Icons: **lucide-react**. Class merging: `cn()` from `src/lib/utils.ts`. Toasts: **sonner**. Path alias `@/` → `src/`.
- Prettier: 100 col, double quotes, semicolons, trailing commas (`all`). `@typescript-eslint/no-unused-vars` is off; `react-refresh/only-export-components` is a warning.
