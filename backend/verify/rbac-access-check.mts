// RBAC access matrix for the exact scenarios in the QA brief — both the frontend
// route guard (guardRedirect) AND live API enforcement (401/403).
//   Student  CANNOT access /admin/*, /instructor/*
//   Teacher  CANNOT access /admin/*
//   Anon     CANNOT access /student/*, /admin/*, /learn/*
import { MongoMemoryServer } from "mongodb-memory-server";
import { guardRedirect, type SessionPrincipal } from "../src/shared/access.ts";

const PORT = 4112;
const BASE = `http://127.0.0.1:${PORT}/api`;
let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`); }
}
function client() {
  let cookie = "";
  async function req(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers["cookie"] = cookie;
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const sc of res.headers.getSetCookie?.() ?? []) if (sc.startsWith("afe_session=")) cookie = sc.split(";")[0];
    let json: any = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b) };
}
async function up(t = 20000) { const s = Date.now(); while (Date.now()-s<t){try{if((await fetch(`${BASE}/health`)).ok)return true}catch{}await new Promise(r=>setTimeout(r,250))} return false; }

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
await import("../src/index.ts");
if (!(await up())) { console.error("not healthy"); process.exit(1); }

console.log("[RBAC access — frontend guard]");
const stu: SessionPrincipal = { id: "s", role: "student", name: "S", email: "s@x", registrationStatus: "approved" };
const pend: SessionPrincipal = { id: "s", role: "student", name: "S", email: "s@x", registrationStatus: "pending" };
const tch: SessionPrincipal = { id: "t", role: "teacher", name: "T", email: "t@x" };

// Student blocked from admin + instructor (→ own home).
check("student → /admin/* blocked (→ /student/dashboard)", guardRedirect("/admin/courses", stu) === "/student/dashboard");
check("student → /instructor/* blocked (→ /student/dashboard)", guardRedirect("/instructor/dashboard", stu) === "/student/dashboard");
// Teacher blocked from admin.
check("teacher → /admin/* blocked (→ /instructor/dashboard)", guardRedirect("/admin/courses", tch) === "/instructor/dashboard");
// Anonymous blocked from student, admin, learn (→ /login).
check("anon → /student/* → /login", guardRedirect("/student/dashboard", null) === "/login");
check("anon → /admin/* → /login", guardRedirect("/admin/courses", null) === "/login");
check("anon → /learn/* → /login", guardRedirect("/learn/some-course/lesson/x", null) === "/login");
check("anon → /instructor/* → /login", guardRedirect("/instructor/dashboard", null) === "/login");
// Positive: learners CAN reach /learn; pending student is funneled to /student/pending.
check("approved student → /learn/* allowed", guardRedirect("/learn/c/lesson/x", stu) === null);
check("teacher → /learn/* allowed (preview)", guardRedirect("/learn/c/lesson/x", tch) === null);
check("pending student → /learn/* funneled to /student/pending", guardRedirect("/learn/c/lesson/x", pend) === "/student/pending");

console.log("\n[RBAC access — live API enforcement]");
const anon = client();
const student = client(); await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
const teacher = client(); await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });

check("anon → admin API (POST /admin/courses) → 401", (await anon.post("/admin/courses", { title: "x" })).status === 401);
check("student → admin API (GET /admin/courses) → 403", (await student.get("/admin/courses")).status === 403);
check("teacher → admin API (GET /admin/courses) → 403", (await teacher.get("/admin/courses")).status === 403);
check("student → admin teachers API → 403", (await student.get("/admin/teachers")).status === 403);
check("student → instructor-data API (GET /analytics/teacher) → 403", (await student.get("/analytics/teacher")).status === 403);
check("anon → student-data API (GET /progress) → 401", (await anon.get("/progress")).status === 401);
check("teacher → student-data API (GET /progress) → 403", (await teacher.get("/progress")).status === 403);
check("anon → admin certificates list → 401", (await anon.get("/certificates")).status === 401);
check("student → admin certificates list → 403", (await student.get("/certificates")).status === 403);

console.log(`\nRBAC ACCESS CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
