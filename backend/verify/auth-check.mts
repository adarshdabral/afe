// Verifies the login pipeline + registration-approval modes end-to-end:
// seeded student/teacher/admin login (by email AND username), afe_session cookie
// creation (httpOnly), GET /auth/me, bad-password rejection, approved-by-default
// self-registration, and the optional teacher-approval flow (REQUIRE_TEACHER_APPROVAL).
import { MongoMemoryServer } from "mongodb-memory-server";
import { guardRedirect, type SessionPrincipal } from "../server/shared/access.ts";

const PORT = 4106;
const BASE = `http://127.0.0.1:${PORT}/api`;
let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`); }
}
function client() {
  let cookie = "", lastSetCookie = "";
  async function req(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers["cookie"] = cookie;
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const sc of res.headers.getSetCookie?.() ?? []) if (sc.startsWith("afe_session=")) { cookie = sc.split(";")[0]; lastSetCookie = sc; }
    let json: any = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }
  return {
    get: (p: string) => req("GET", p),
    post: (p: string, b?: unknown) => req("POST", p, b),
    hasCookie: () => !!cookie,
    lastSetCookie: () => lastSetCookie,
  };
}
async function waitForHealth(t = 20000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  return false;
}

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
delete process.env.REQUIRE_TEACHER_APPROVAL; // default → approved immediately
await (await import("./_server.mts")).startServer();
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }

console.log("[Auth + approval checks]");

// 1. Seeded logins by email — cookie + /me for every role.
const roles: Array<[string, string, string]> = [
  ["student@afe.edu", "Student@123", "student"],
  ["teacher@afe.edu", "Teacher@123", "teacher"],
  ["admin@afe.edu", "Admin@123", "platform_admin"],
];
for (const [login, password, role] of roles) {
  const c = client();
  const r = await c.post("/auth/login", { login, password });
  check(`seed login ${login} → 200 role=${role}`, r.status === 200 && r.json?.data?.role === role, { status: r.status, role: r.json?.data?.role });
  check(`  ${login} sets afe_session cookie`, c.hasCookie());
  check(`  ${login} cookie is httpOnly`, /httponly/i.test(c.lastSetCookie()), c.lastSetCookie());
  const me = await c.get("/auth/me");
  check(`  GET /auth/me → ${role}`, me.status === 200 && me.json?.data?.role === role, me.json?.data);
}

// 2. Seeded logins by USERNAME (identifiers self-healed by the seed).
for (const [login, password, role] of [
  ["aarav", "Student@123", "student"],
  ["dsj", "Teacher@123", "teacher"],
  ["Moocs@admin", "Admin@123", "platform_admin"],
] as Array<[string, string, string]>) {
  const r = await client().post("/auth/login", { login, password });
  check(`seed login by username "${login}" → 200 role=${role}`, r.status === 200 && r.json?.data?.role === role, { status: r.status, role: r.json?.data?.role });
}

// 3. Bad password → 401.
{
  const r = await client().post("/auth/login", { login: "student@afe.edu", password: "wrong" });
  check("bad password → 401", r.status === 401, r.status);
}

// 4. Seeded student is approved (not blocked) — guardRedirect allows the dashboard.
{
  const c = client();
  const me = (await c.post("/auth/login", { login: "student@afe.edu", password: "Student@123" }), await c.get("/auth/me"));
  const principal = me.json?.data as SessionPrincipal;
  check("seed student regStatus=approved", principal?.registrationStatus === "approved", principal);
  check("approved student → /student/dashboard allowed (no pending redirect)", guardRedirect("/student/dashboard", principal) === null);
}

// 5. Public self-registration is APPROVED by default (no teacher approval).
const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
// Registration now needs no teacher selection / class / roll number.
const reg = (over: Record<string, unknown> = {}) => ({
  fullName: "New Student", email: "new.student@x.io", password: "Passw0rd!",
  mobileNumber: "9001112223", schoolName: "Springfield High", ...over,
});
{
  const s = client();
  const r = await s.post("/registrations", reg());
  check("default self-register → 201 approved", r.status === 201 && r.json?.data?.registrationStatus === "approved", r.json?.data);
  const me = await s.get("/auth/me");
  check("registered student can access immediately (approved)", me.json?.data?.registrationStatus === "approved", me.json?.data);
  check("approved student not redirected to pending", guardRedirect("/student/dashboard", me.json?.data as SessionPrincipal) === null);
}

// 6. Optional approval flow — REQUIRE_TEACHER_APPROVAL=true → pending → teacher approves.
{
  process.env.REQUIRE_TEACHER_APPROVAL = "true";
  const s = client();
  const r = await s.post("/registrations", reg({ email: "pending.student@x.io", mobileNumber: "9004445556" }));
  check("with flag on → 201 pending", r.status === 201 && r.json?.data?.registrationStatus === "pending", r.json?.data);
  const mine = await s.get("/registrations/mine");
  const reqId = mine.json?.data?.request?.id;
  check("pending student → guardRedirect funnels to /student/pending", guardRedirect("/student/dashboard", { id: "x", role: "student", name: "n", email: "e", registrationStatus: "pending" }) === "/student/pending");
  // Teacher (the seeded teacher owns the directory teacher) approves.
  const teacher = client();
  await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
  const dec = await teacher.post(`/registrations/${reqId}/decide`, { decision: "approved" });
  check("teacher approves pending request → 200 approved", dec.status === 200 && dec.json?.data?.status === "approved", dec.json?.data);
  const me = await s.get("/auth/me");
  check("student becomes approved after teacher decision", me.json?.data?.registrationStatus === "approved", me.json?.data);
  delete process.env.REQUIRE_TEACHER_APPROVAL;
}

console.log(`\nAUTH CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
