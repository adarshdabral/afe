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

export function ensureBuild(): void {
  const buildId = path.join(ROOT, ".next", "BUILD_ID");
  const built = fs.existsSync(buildId) ? fs.statSync(buildId).mtimeMs : 0;
  if (built && Math.max(...SOURCES.map(newestMtime)) <= built) return;
  console.log("[verify] building the backend (sources changed since the last build)…");
  execSync("npx next build", { cwd: ROOT, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
}

export async function startServer(port = Number(process.env.PORT ?? 3000)): Promise<void> {
  ensureBuild();
  process.env.PORT = String(port);
  const app = next({ dev: false, dir: ROOT, hostname: "127.0.0.1", port });
  await app.prepare();
  const handler = app.getRequestHandler();
  await new Promise<void>((resolve) => createServer((req, res) => handler(req, res)).listen(port, "127.0.0.1", resolve));
}
