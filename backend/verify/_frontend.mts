// Starts the real FRONTEND app (`next start`) as a child process, wired to a
// backend at `backendUrl`. NEXT_PUBLIC_BACKEND_URL is inlined at build time (the
// /api rewrite, middleware), so the frontend is rebuilt whenever its sources are
// newer than the build OR it was last built for a different backend URL.
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend");
const SOURCES = ["app", "components", "context", "hooks", "lib", "middleware.ts", "next.config.ts", "package.json"];
const MARKER = path.join(FRONTEND, ".next", "verify-backend-url");

function newestMtime(p: string): number {
  const full = path.join(FRONTEND, p);
  if (!fs.existsSync(full)) return 0;
  const st = fs.statSync(full);
  if (!st.isDirectory()) return st.mtimeMs;
  let max = st.mtimeMs;
  for (const e of fs.readdirSync(full)) max = Math.max(max, newestMtime(path.join(p, e)));
  return max;
}

function ensureFrontendBuild(backendUrl: string): void {
  const buildId = path.join(FRONTEND, ".next", "BUILD_ID");
  const built = fs.existsSync(buildId) ? fs.statSync(buildId).mtimeMs : 0;
  const sameBackend = fs.existsSync(MARKER) && fs.readFileSync(MARKER, "utf8") === backendUrl;
  if (built && sameBackend && Math.max(...SOURCES.map(newestMtime)) <= built) return;
  console.log(`[verify] building the frontend for backend ${backendUrl}…`);
  execSync("npx next build", {
    cwd: FRONTEND,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_BACKEND_URL: backendUrl },
  });
  fs.writeFileSync(MARKER, backendUrl);
}

export async function startFrontend(backendUrl: string, port: number): Promise<ChildProcess> {
  ensureFrontendBuild(backendUrl);
  // `detached` → own process group, so stop() kills npx → next → next-server together.
  const child = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: FRONTEND,
    env: { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_BACKEND_URL: backendUrl },
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  const start = Date.now();
  while (Date.now() - start < 60000) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/login`, { redirect: "manual" })).status > 0) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  stopFrontend(child);
  throw new Error("frontend did not start");
}

export function stopFrontend(child: ChildProcess): void {
  try {
    if (child.pid) process.kill(-child.pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}
