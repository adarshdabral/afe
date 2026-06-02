// End-to-end verification of the Next.js RBAC middleware: boots the real Express
// API (ephemeral Mongo) on :4000 and `next start` on :3000, then asserts the
// actual HTTP redirects produced by frontend/middleware.ts.
import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, "../../frontend");

let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`); }
}

async function waitFor(url: string, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url, { redirect: "manual" }); if (r.status > 0) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = "4000";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";

console.log("Starting Express API on :4000 …");
await import("../src/index.ts");
if (!(await waitFor("http://127.0.0.1:4000/api/health"))) { console.error("API not healthy"); process.exit(1); }

console.log("Starting `next start` on :3000 …");
// `detached` puts next-server in its own process group so we can kill the whole
// tree (npx → next → next-server) — otherwise the grandchild orphans on :3000.
const next = spawn("npx", ["next", "start", "-p", "3000"], {
  cwd: frontendDir,
  env: { ...process.env },
  stdio: ["ignore", "ignore", "inherit"],
  detached: true,
});
const nextUp = await waitFor("http://127.0.0.1:3000/");
if (!nextUp) { console.error("next start did not come up"); next.kill("SIGKILL"); process.exit(1); }

// Helper: get a session cookie by logging into the backend directly.
async function loginCookie(login: string, password: string): Promise<string> {
  const res = await fetch("http://127.0.0.1:4000/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  const c = sc.map((s) => s.split(";")[0]).find((s) => s.startsWith("afe_session="));
  return c ?? "";
}

// Hit the Next app with redirect handling disabled so we observe the 307 itself.
async function nav(path: string, cookie?: string) {
  const res = await fetch(`http://127.0.0.1:3000${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, location: res.headers.get("location") };
}

try {
  console.log("\n[Middleware E2E]");
  // 1. Unauthenticated → protected → /login
  {
    const r = await nav("/student/dashboard");
    check("anon /student/dashboard → redirect /login", isRedirect(r, "/login"), r);
  }
  {
    const r = await nav("/instructor/dashboard");
    check("anon /instructor/dashboard → redirect /login", isRedirect(r, "/login"), r);
  }
  {
    const r = await nav("/admin/dashboard");
    check("anon /admin/dashboard → redirect /login", isRedirect(r, "/login"), r);
  }

  // 2. Authenticated student (seed is approved) → own area allowed, others redirected
  const studentCookie = await loginCookie("student@afe.edu", "Student@123");
  check("backend login (student) returned cookie", !!studentCookie);
  {
    const r = await nav("/student/dashboard", studentCookie);
    check("student → /student/dashboard → allowed (200)", r.status === 200, r);
  }
  {
    const r = await nav("/instructor/dashboard", studentCookie);
    check("student → /instructor/dashboard → redirect /student/dashboard", isRedirect(r, "/student/dashboard"), r);
  }
  {
    const r = await nav("/admin/dashboard", studentCookie);
    check("student → /admin/dashboard → redirect /student/dashboard", isRedirect(r, "/student/dashboard"), r);
  }
  {
    const r = await nav("/login", studentCookie);
    check("authed student on /login → redirect /student/dashboard", isRedirect(r, "/student/dashboard"), r);
  }

  // 3. Teacher → instructor allowed, admin/student redirected to own home
  const teacherCookie = await loginCookie("teacher@afe.edu", "Teacher@123");
  {
    const r = await nav("/instructor/dashboard", teacherCookie);
    check("teacher → /instructor/dashboard → allowed (200)", r.status === 200, r);
  }
  {
    const r = await nav("/admin/dashboard", teacherCookie);
    check("teacher → /admin/dashboard → redirect /instructor/dashboard", isRedirect(r, "/instructor/dashboard"), r);
  }

  // 4. Platform admin → both admin and instructor allowed
  const adminCookie = await loginCookie("admin@afe.edu", "Admin@123");
  {
    const r = await nav("/admin/dashboard", adminCookie);
    check("platform_admin → /admin/dashboard → allowed (200)", r.status === 200, r);
  }
  {
    const r = await nav("/instructor/dashboard", adminCookie);
    check("platform_admin → /instructor/dashboard → allowed (200)", r.status === 200, r);
  }
} finally {
  console.log(`\n========================================`);
  console.log(`MIDDLEWARE E2E: ${pass} passed, ${fail} failed`);
  if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
  console.log(`========================================`);
  // Kill the whole next process group, then sweep the ports to be certain.
  try { if (next.pid) process.kill(-next.pid, "SIGKILL"); } catch { /* already gone */ }
  for (const port of [3000, 4000]) {
    try {
      const pids = execSync(`lsof -ti tcp:${port} || true`).toString().trim().split(/\s+/).filter(Boolean);
      for (const pid of pids) { try { process.kill(Number(pid), "SIGKILL"); } catch { /* gone */ } }
    } catch { /* lsof unavailable */ }
  }
  await mongo.stop();
  process.exit(fail ? 1 : 0);
}

function isRedirect(r: { status: number; location: string | null }, to: string): boolean {
  return (r.status === 307 || r.status === 308 || r.status === 302) && (r.location === to || r.location?.endsWith(to) === true);
}
