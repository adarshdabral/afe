# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A MOOC / online-learning platform UI ("ai-spark") built with **TanStack Start** (full-stack React + SSR), React 19, Tailwind v4, and shadcn/ui. It is a Lovable-generated project. There is currently **no backend or real auth** — all data is mock data in `src/data/mock.ts`, and app state lives in a single client-side React context (`src/context/AppContext.tsx`) persisted to `localStorage`.

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
Server entry is redirected to `src/server.ts` (an SSR error wrapper that normalizes h3's swallowed 500s into a rendered error page); `src/start.ts` adds request middleware. For server-side logic:
- Use **`createServerFn`** (see `src/lib/api/example.functions.ts`) — the `.handler` body is server-only and tree-shaken from the client bundle. Use this instead of separate edge functions.
- Truly server-only helpers go in **`*.server.ts`** files (e.g. `src/lib/config.server.ts`) — the suffix keeps them out of the client bundle.
- On the Cloudflare Workers target, env binds **per-request**: read `process.env` *inside* a function/handler, never at module scope. Public config uses the `VITE_` prefix via `import.meta.env` (ships to the browser — no secrets).

### State & data
- All domain types and seed data are in `src/data/mock.ts` (courses, lessons, quizzes, certificates, admin/instructor entities, `currentUser`).
- `AppContext` (`useApp()`) holds the mutable session state (enrollment, progress, notes, dark mode, admin approval queues) and persists `darkMode` + `notes` to `localStorage` under `afe.*` keys. There is no login flow wired to it — `currentUser.role` is hardcoded to `"student"`.
- The three user surfaces — student, instructor, admin — each have a sidebar component (`StudentSidebar`, `InstructorSidebar`, `AdminSidebar`) and their own routes (`student.*`, `instructor.*`, `admin.*`).

### UI conventions
- shadcn/ui ("new-york" stylex) in `src/components/ui/`; configured via `components.json`. Add components with the shadcn CLI rather than hand-writing.
- Icons: **lucide-react**. Class merging: `cn()` from `src/lib/utils.ts`. Toasts: **sonner**. Path alias `@/` → `src/`.
- Prettier: 100 col, double quotes, semicolons, trailing commas (`all`). `@typescript-eslint/no-unused-vars` is off; `react-refresh/only-export-components` is a warning.
