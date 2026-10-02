// Boots the real backend Next.js app (API Route Handlers + its middleware) in
// THIS process on process.env.PORT, against whatever MONGODB_URI the harness set.
// Running in-process means harnesses can still flip env flags at runtime (e.g.
// REQUIRE_TEACHER_APPROVAL) exactly as they did against the old Express app.
//
// Uses the production build in .next/. If any source file is newer than the
// build, it rebuilds first so a harness never tests stale code.
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import next from "next";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Harness builds live apart from .next/ (owned by `npm run dev`) — see next.config.ts.
const DIST = ".next-verify";
process.env.NEXT_DIST_DIR = DIST;
const SOURCES = ["app", "server", "middleware.ts", "instrumentation.ts", "next.config.ts", "package.json"];

function newestMtime(p: string): number {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return 0;
  const st = fs.statSync(full);
  if (!st.isDirectory()) return st.mtimeMs;
  let max = st.mtimeMs;
  for (const e of fs.readdirSync(full)) max = Math.max(max, newestMtime(path.join(p, e)));
  return max;
}

/**
 * Build once, safely: concurrent harness runs (e.g. two terminals) must never run
 * `next build` into the same folder at the same time — that corrupts the output
 * ("Invariant: no direct app page entry found …"). A lock directory serializes
 * builds; waiters re-check freshness after acquiring it, so they reuse the build.
 */
export function ensureBuild(): void {
  const buildId = path.join(ROOT, DIST, "BUILD_ID");
  const fresh = () => {
    const built = fs.existsSync(buildId) ? fs.statSync(buildId).mtimeMs : 0;
    return built > 0 && Math.max(...SOURCES.map(newestMtime)) <= built;
  };
  if (fresh()) return;
  const lock = path.join(ROOT, `${DIST}.lock`);
  const started = Date.now();
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch {
      // Someone else is building. Take over a lock older than 10 minutes (crashed run).
      if (Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? 0) > 10 * 60 * 1000) {
        fs.rmSync(lock, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - started > 15 * 60 * 1000) throw new Error("timed out waiting for another harness build");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); // sleep 1s (sync)
    }
  }
  try {
    if (fresh()) return; // built by whoever held the lock
    const build = () =>
      execSync("npx next build", { cwd: ROOT, stdio: "inherit", env: { ...process.env, NODE_ENV: "production", NEXT_DIST_DIR: DIST } });
    console.log("[verify] building the backend (sources changed since the last build)…");
    try {
      build();
    } catch {
      console.log("[verify] build failed — retrying once from a clean folder…");
      fs.rmSync(path.join(ROOT, DIST), { recursive: true, force: true });
      build();
    }
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

/**
 * Keep the developer's backend/.env OUT of harness runs. Next.js loads .env files
 * into process.env for any key that isn't already defined — which would point
 * tests at real MongoDB/R2/Workers AI credentials. Every key those files define
 * that the harness hasn't set itself becomes "" (all config treats blank as unset).
 */
function isolateFromDotenv(): void {
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local", ".env.test", ".env.test.local"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
      if (key && process.env[key] === undefined) process.env[key] = "";
    }
  }
}

export async function startServer(port = Number(process.env.PORT ?? 3000)): Promise<void> {
  // If a harness crashes mid-run, its open servers keep Node alive forever; fail
  // loudly instead of hanging. (unref: doesn't itself keep the process alive.)
  setTimeout(() => {
    console.error("\n[verify] harness did not finish within 10 minutes — aborting.");
    process.exit(1);
  }, 10 * 60 * 1000).unref();
  isolateFromDotenv();
  ensureBuild();
  process.env.PORT = String(port);
  const app = next({ dev: false, dir: ROOT, hostname: "127.0.0.1", port });
  await app.prepare();
  const handler = app.getRequestHandler();
  await new Promise<void>((resolve) => createServer((req, res) => handler(req, res)).listen(port, "127.0.0.1", resolve));
}
