// End-to-end check of the two-app setup: boots the BACKEND (API, in-process) and
// the FRONTEND (`next start`, wired to it via NEXT_PUBLIC_BACKEND_URL), then
// asserts — through the frontend origin, as a browser would — the SSR landing page,
// the /courses redirect, the /api rewrite to the backend (JSON 404 / 401, login
// cookie set first-party) and the RBAC redirects produced by frontend/middleware.ts.
import { MongoMemoryServer } from "mongodb-memory-server";
import { startFrontend, stopFrontend } from "./_frontend.mts";

const BACKEND_PORT = 4130;
const FRONTEND_PORT = 3130;
const BACKEND = `http://127.0.0.1:${BACKEND_PORT}`;
const ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`; // the browser-facing origin

let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`); }
}

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.NODE_ENV = "test";

console.log(`Starting the backend on :${BACKEND_PORT} …`);
await (await import("./_server.mts")).startServer(BACKEND_PORT);
const health = await fetch(`${BACKEND}/api/health`);
if (!health.ok) { console.error("backend not healthy"); process.exit(1); }
const { seedAiCourse } = await import("../server/seed/course.seed.ts");
await seedAiCourse();

console.log(`Starting the frontend on :${FRONTEND_PORT} …`);
const frontend = await startFrontend(BACKEND, FRONTEND_PORT);

// Helper: log in THROUGH THE FRONTEND's /api rewrite (as the browser does).
async function loginCookie(login: string, password: string): Promise<string> {
  const res = await fetch(`${ORIGIN}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  const c = sc.map((s) => s.split(";")[0]).find((s) => s.startsWith("afe_session="));
  return c ?? "";
}

// Hit the Next app with redirect handling disabled so we observe the 307 itself.
async function nav(path: string, cookie?: string) {
  const res = await fetch(`${ORIGIN}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, location: res.headers.get("location") };
}

try {
  console.log("\n[Middleware E2E]");
  // 0. Single-origin app: SSR landing, /courses redirect, API envelope.
  {
    const res = await fetch(`${ORIGIN}/`);
    const html = await res.text();
    check("GET / → 200 server-rendered with the course from MongoDB", res.status === 200 && html.includes("Understanding Artificial Intelligence"), res.status);
  }
  {
    const r = await nav("/courses");
    check("/courses → redirect /courses/ai-for-everyone", isRedirect(r, "/courses/ai-for-everyone"), r);
  }
  {
    const res = await fetch(`${ORIGIN}/api/does-not-exist`);
    const body = await res.json().catch(() => null);
    check("frontend /api rewrite → backend JSON 404 envelope", res.status === 404 && typeof body?.error?.message === "string", { status: res.status, body });
  }
  {
    const res = await fetch(`${ORIGIN}/api/progress`);
    check("frontend /api rewrite → protected API without session → 401", res.status === 401);
  }

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
  check("login via frontend /api rewrite sets the session cookie", !!studentCookie);
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
  stopFrontend(frontend);
  await mongo.stop();
  process.exit(fail ? 1 : 0);
}

function isRedirect(r: { status: number; location: string | null }, to: string): boolean {
  return (r.status === 307 || r.status === 308 || r.status === 302) && (r.location === to || r.location?.endsWith(to) === true);
}
