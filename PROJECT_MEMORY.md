# PROJECT_MEMORY.md

Durable engineering memory for **ai-spark** ("AI For Everyone" / SRS: *Demystifying AI for Everyone*).
Read this before adding features so new code matches existing conventions instead of inventing new ones.
Source of truth for behavior is `CLAUDE.md` (build/runtime rules) + `src/routes/README.md` (routing) + `SRS.pdf` (product requirements). This file captures the *coding* conventions distilled from the current codebase.

---

## 1. Architecture Summary

- **Stack:** TanStack Start (full-stack React + SSR) · React 19 · Tailwind v4 · shadcn/ui ("new-york") · TypeScript · Bun. Lovable-generated.
- **No backend / no real auth (yet).** All domain data is mock data in `src/data/mock.ts`; all mutable session state is one client-side React context (`src/context/AppContext.tsx`) with partial `localStorage` persistence. Auth screens are cosmetic (`setTimeout` → `navigate`); `currentUser.role` is hardcoded `"student"`.
- **App shell:** `src/routes/__root.tsx` is the only layout. It provides the `<html>` shell (`RootShell`), mounts `QueryClientProvider` → `AppProvider` → `<Outlet />` + `<Toaster />`, and defines root `notFoundComponent` / `errorComponent`. Preserve `<Outlet />`.
- **Three user surfaces:** `student.*`, `instructor.*`, `admin.*` — each with its own sidebar component and route prefix. (SRS expands roles to Student / Teacher / School-Admin / Platform-Admin; current code has student/instructor/admin only.)
- **Build config is wrapped** by `@lovable.dev/vite-tanstack-config` (already bundles `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, `nitro`, `@` alias, error loggers, `VITE_*` injection). Never re-add these plugins to `vite.config.ts` — pass extra config via `defineConfig({ vite: {...} })`.
- **Server entry:** `src/server.ts` (SSR 500 → rendered error page) + `src/start.ts` (request middleware). React Query is wired but currently unused for data fetching (no server).
- **Build target:** Nitro → Cloudflare by default. On Workers, env binds per-request → read `process.env` *inside* handlers, never at module scope.

```
src/
  routes/        file-based routes (dot-separated paths) + README.md; routeTree.gen.ts is AUTO-GENERATED
  components/    domain components + components/ui/ (shadcn primitives)
  context/       AppContext.tsx — global state via useApp()
  data/          mock.ts — ALL domain types + seed data (single source of truth)
  hooks/         use-mobile.tsx
  lib/           api/ (createServerFn), *.server.ts, categoryColor, utils (cn), error-*
  router.tsx · server.ts · start.ts · styles.css · routeTree.gen.ts
```

---

## 2. Routing Conventions

- **File-based routing** in `src/routes/`. Dot-separated filenames map to nested URLs; dynamic segments use a bare `$`:
  - `student.learn.$id.tsx` → `/student/learn/:id`
  - `courses.$id.tsx` → `/courses/:id`
  - `student.dashboard.tsx` → `/student/dashboard`
- **`routeTree.gen.ts` is auto-generated** — never hand-edit (always shows as modified in git).
- **Do NOT** create `src/pages/`, `app/layout.tsx`, `_layout.tsx` (Next/Remix conventions), or use the `server-only` package (eslint blocks it).
- Every route exports `Route = createFileRoute("/path")({ ... })` with:
  - `head: () => ({ meta: [{ title: "… — AI For Everyone" }] })` — always set a per-page title; `head` may take `({ params })` for dynamic titles/descriptions (see `courses.$id.tsx`).
  - `loader: ({ params }) => { const x = …find(); if (!x) throw notFound(); return x; }` for entity lookups; read it with `Route.useLoaderData()`.
  - `component: PascalCaseFn`.
- **Navigation:** `<Link to="/path/$id" params={{ id }}>`; programmatic `useNavigate()({ to: "…" })`. Active link detection: `useRouterState({ select: (s) => s.location.pathname })`.
- **No route guards exist.** Auth/role gating is not implemented — add it deliberately if the SRS approval flow (FR-02) requires it.
- Each page route renders its own surface sidebar inline (no shared authenticated layout route yet).

---

## 3. State Management Conventions

- **Single global context:** `AppContext` exposed via `useApp()` (throws if used outside `AppProvider`). No Redux/Zustand/Jotai.
- **Shape:** `currentUser` (incl. `enrolledCourseIds`, `progress: Record<courseId, pct>`, `certificatesEarned`, `hoursLearned`), `certificates`, `notes: Record<lessonId, string>`, `darkMode`, and admin queues (`pendingInstructors`, `pendingCourses`, `adminUsers`).
- **Mutators are the public API** — never mutate state shape ad hoc. Existing: `enroll`, `updateProgress`, `completeCourse`, `saveNote`, `toggleDarkMode`, `approveInstructor`, `rejectInstructor`, `approveCourse`, `rejectCourse`, `suspendUser`, `activateUser`. Add new shared state by extending the `AppContextType` interface, the provider `useState`, and the `value` object together.
- **Updater style:** functional immutable updates — `setX((prev) => ({ ...prev, … }))`. Progress merges monotonically via `Math.max`. `completeCourse` mints a `Certificate` inline.
- **Persistence:** only `darkMode` and `notes` persist to `localStorage` under `afe.*` keys, hydrated in a client-only `useEffect` (guarded by `typeof document/localStorage` and `try/catch`). Everything else resets on reload. Follow the `afe.<key>` namespace + try/catch pattern for any new persisted slice.
- **Local component state for UI-only concerns** (quiz answers/timer, active lesson index, tabs, dialog open, locally-mutated Q&A lists). These are ephemeral per-mount and intentionally NOT in context. Some seed arrays (e.g. `qna`) are copied into local `useState` and mutated locally.
- Artificial loading is simulated with `setTimeout(() => setLoading(false), 300–1000)` to exercise skeletons/spinners.

---

## 4. UI Component Reuse Rules

- **Add shadcn/ui primitives via the shadcn CLI**, not by hand. Config: `components.json` (style `new-york`, base `slate`, icon lib lucide, no prefix). They live in `src/components/ui/` — treat as generated; don't hand-author new ones.
- **Reuse the domain component before building new UI:** `CourseCard` (variant-driven), `CourseCardSkeleton`, `Navbar`, and the three sidebars.
- **Class merging is always `cn()`** from `@/lib/utils` — never concatenate Tailwind strings where conditional classes overlap.
- **Icons: lucide-react only.** Toasts: **sonner** `toast.success(...)` / `toast(...)`. Celebrations: `canvas-confetti`. Modals: shadcn `Dialog`.
- **Theme tokens, not raw colors, for surfaces/text:** `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-input`. Accent is **violet-600** (`bg-violet-600 hover:bg-violet-700 text-white`). Status colors follow the `bg-{color}-100 text-{color}-700 dark:bg-{color}-500/20 dark:text-{color}-300` formula (see `CourseCard.statusColor`, `categoryColor.ts`).
- **Every element ships a `dark:` variant.** Borders are typically `border-gray-100 dark:border-gray-700/800`.
- **Shape/spacing idioms:** buttons/inputs/badges `rounded-xl`; cards/panels `rounded-2xl shadow-sm border`; page containers `max-w-{6xl|7xl} mx-auto px-4 sm:px-6 py-8`.
- **Responsive split:** desktop sidebar (`hidden lg:flex`) + mobile bottom tab bar (`lg:hidden fixed bottom-0`); content gets `pb-20 lg:pb-0` to clear the mobile bar.
- **Repeated inline sub-components** (not yet extracted, reuse the pattern or extract if used 3+ times): inline `Stars` rating, `EmptyState`, `FilterGroup`, the radial-progress SVG (quiz results), and lesson-type icon maps (`lessonIcon`).

---

## 5. Data Layer Conventions

- **`src/data/mock.ts` is the single source of truth** for both domain **types** and **seed data**. Every entity + its `interface`/`type` lives here: `Course`, `Module`, `Lesson`, `Instructor`, `CurrentUser`, `QuizQuestion`, `Assignment`, `Certificate`, `QnA`, `Announcement`, `Review`, `AdminStats`, `PendingInstructor`, `PendingCourse`, `AdminUser`, plus unions `Category`, `Level`, `LessonType`. **New entities/types go here**, not scattered across files.
- Routes/components **import types and seed arrays directly** from `@/data/mock` and filter in-memory (`courses.find(c => c.id === id)`, `reviews.filter(r => r.courseId === id)`).
- IDs are **string literals** with structured prefixes: courses `"1".."10"`; nested content `c{n}-m{n}-l{n}` (built by `mkModules(prefix)`); records prefixed by entity (`cert*`, `qa*`, `an*`, `r*`, `a*`, `pi*`, `pc*`, `au*`, `u1`).
- Generated runtime IDs use template + timestamp/random: `` `cert-${courseId}-${Date.now()}` ``, `` `q-${Date.now()}` ``, verification IDs `AFE-CERT-XXXX-2026`.
- **Server-side logic, when a backend is added:** use `createServerFn({ method }).inputValidator(zodSchema).handler(async ({ data }) => …)` (template: `src/lib/api/example.functions.ts`) — the `.handler` body is server-only and tree-shaken. Truly server-only helpers go in `*.server.ts` files (e.g. `src/lib/config.server.ts`). Read `process.env` **inside** handlers (per-request on Cloudflare). Public config uses `VITE_` prefix via `import.meta.env` (ships to browser — no secrets).
- **Validation:** `zod` is the validation lib (used by `createServerFn` input validators and available via `@hookform/resolvers` for forms).

---

## 6. Naming Conventions

- **Route files:** lowercase dot-separated, dynamic segment bare `$` — `surface.feature.$param.tsx` (e.g. `student.quiz.$id.tsx`).
- **Components:** PascalCase files exporting a named PascalCase component (`CourseCard.tsx` → `export function CourseCard`). Route components are local PascalCase fns named for the page (`Dashboard`, `Player`, `Quiz`, `Catalog`, `CourseDetail`).
- **Hooks:** `useX` camelCase; file is kebab-case (`use-mobile.tsx` → `useIsMobile`). The context hook is `useApp`.
- **Utilities/helpers:** camelCase functions in kebab/camel-case lib files (`categoryBadgeClass` in `categoryColor.ts`, `cn` in `utils.ts`).
- **Server-only files:** must end in `.server.ts`. Server functions live in `*.functions.ts` under `lib/api/`.
- **Types/interfaces:** PascalCase; string-literal unions for enums (`type Level = "Beginner" | "Intermediate" | "Advanced"`).
- **localStorage keys:** `afe.` namespace (`afe.darkMode`, `afe.notes`).
- **Context mutators:** verb-first camelCase mirroring the action (`enroll`, `approveCourse`, `suspendUser`).
- **Brand strings:** user-facing app name is "AI For Everyone"; page titles end with `" — AI For Everyone"`.

---

## 7. Coding Standards

- **Package manager: Bun** (`bun install`, `bun run dev|build|lint|format`). The untracked `package-lock.json` is incidental — prefer Bun. `bunfig.toml` enforces a 24h supply-chain guard.
- **Prettier** (`.prettierrc`): 100 col, double quotes, semicolons, trailing commas `all`. Run `bun run format`.
- **ESLint** (`eslint.config.js`): `bun run lint`. `@typescript-eslint/no-unused-vars` is **off**; `react-refresh/only-export-components` is a **warning**; the `server-only` import is **blocked**.
- **No test framework configured** — there are no tests to run/write. Keep new pure logic (e.g. scoring, scheduling) in side-effect-free helpers so it stays testable if a runner is added.
- **Imports:** use the `@/` alias (`@/components`, `@/lib`, `@/data`, `@/context`, `@/hooks`) — not deep relative paths. (Note: `__root.tsx` uses a couple of `../` imports; new code should prefer `@/`.)
- **Module-scope rule:** never read `process.env` at module top level (Cloudflare per-request binding) — do it inside functions/handlers.
- **Feedback over silence:** confirm actions with `toast`, gate buttons with `disabled` while loading, render `EmptyState`/empty-copy for empty lists.
- **TypeScript:** `tsconfig.json` strict; loader data is occasionally cast (`Route.useLoaderData() as Course`).

---

## 8. Existing Reusable Components

Domain (`src/components/`):
- `CourseCard` — variant-driven (`catalog` | `enrolled` | `instructor`), optional `status` (Draft/Pending/Published/Rejected), `studentCount`, `onDelete`; pulls live `progress` from `useApp()`; renders inline `Stars`.
- `CourseCardSkeleton` — loading placeholder grid item.
- `Navbar` — public/marketing header with dark-mode toggle (scroll-aware shadow).
- `StudentSidebar` / `InstructorSidebar` / `AdminSidebar` — per-surface nav: desktop `aside` + mobile bottom tab bar, active via `useRouterState`.

UI primitives (`src/components/ui/`, shadcn — ~50): `accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart (recharts), checkbox, collapsible, command (cmdk), context-menu, dialog, drawer (vaul), dropdown-menu, form (react-hook-form), hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip`.

Not-yet-extracted but repeated (candidates to promote): `EmptyState`, `FilterGroup`, `Stars`, radial-progress ring, `lessonIcon` map.

---

## 9. Existing Reusable Hooks

- `useApp()` — `src/context/AppContext.tsx`. The global state accessor (current user, enrollment, progress, certificates, notes, dark mode, admin queues + all mutators). Primary hook for any shared/persisted state.
- `useIsMobile()` — `src/hooks/use-mobile.tsx`. `matchMedia` at 768px breakpoint; returns `boolean`.
- `useSidebar()` — exported by `src/components/ui/sidebar.tsx` (shadcn sidebar context), available if the shadcn sidebar primitive is adopted.
- From libraries (use directly, don't wrap unnecessarily): TanStack Router `useNavigate`, `useRouter`, `useRouterState`, `Route.useLoaderData`, `Route.useParams`, `Route.useRouteContext`; React Query hooks (provider is mounted).

---

## 10. Existing Reusable Utilities

- `cn(...inputs)` — `src/lib/utils.ts`. `clsx` + `tailwind-merge`. Use for all conditional class composition.
- `categoryBadgeClass(category)` — `src/lib/categoryColor.ts`. Maps `Category` → Tailwind badge classes (with dark variants). Extend the `switch` if adding categories.
- `getServerConfig()` — `src/lib/config.server.ts`. Server-only config reader (`*.server.ts` pattern).
- `getGreeting` — `src/lib/api/example.functions.ts`. Reference template for `createServerFn` + zod input validation; copy this shape for new server functions.
- Error plumbing — `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts` (`reportLovableError(error, { boundary })`, called from the root `errorComponent`). Don't duplicate; reuse for new error boundaries.
- `getRouter()` — `src/router.tsx`. Builds the `QueryClient` + router (context `{ queryClient }`, `scrollRestoration`). Single place to adjust router-level config.

> Conventions captured from the current tree. When in doubt, grep an existing route/component of the same surface and mirror it rather than introducing a new pattern. Re-derive this file if `mock.ts`, `AppContext`, or the routing scheme changes materially.
