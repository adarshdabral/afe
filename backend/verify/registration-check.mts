// Verifies the student registration workflow after the UX cleanup:
// - registration needs only fullName/email/password/mobileNumber/schoolName
//   (NO class, roll number, or teacher selection)
// - every student is AUTO-ASSIGNED to the default teacher (Dr Sudhanshu Joshi)
// - ownership + approval/rejection, unauthorized access, admin visibility,
//   pending-redirect (guardRedirect), and graceful failure if the default
//   teacher is missing.
import { MongoMemoryServer } from "mongodb-memory-server";
import { guardRedirect, type SessionPrincipal } from "../src/shared/access.ts";

const PORT = 4100;
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
  return {
    get: (p: string) => req("GET", p),
    post: (p: string, b?: unknown) => req("POST", p, b),
    hasCookie: () => !!cookie,
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
process.env.REQUIRE_TEACHER_APPROVAL = "true"; // this harness tests the approval workflow
await import("../src/index.ts");
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }

console.log("[Registration workflow checks]");

// The seeded teacher IS the default teacher (auto-assignment target).
const DEFAULT_TEACHER_ID = "u-teacher";
const DEFAULT_TEACHER_NAME = "Dr Sudhanshu Joshi";

const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
// A second teacher — used to prove they do NOT own auto-assigned students.
const tB = await admin.post("/admin/teachers", { name: "Teacher Beta", email: "beta@school.io" });
const teacherBPass = tB.json?.data?.credentials?.temporaryPassword;

const validReg = (over: Record<string, unknown> = {}) => ({
  fullName: "Sam Learner",
  email: "sam@student.io",
  password: "Passw0rd!",
  mobileNumber: "9998887777",
  schoolName: "Riverside High",
  ...over,
});

// 1. Registration needs no teacher / class / roll number.
const student = client();
let studentReqId = "";
{
  const r = await student.post("/registrations", validReg());
  check("register (no teacher/class/roll) → 201 pending", r.status === 201 && r.json?.data?.registrationStatus === "pending", r.json?.data);
  check("register set session cookie", student.hasCookie());
  const mine = await student.get("/registrations/mine");
  const request = mine.json?.data?.request;
  studentReqId = request?.id ?? "";
  check("AUTO-ASSIGNED to default teacher (Dr Sudhanshu Joshi)", request?.teacherId === DEFAULT_TEACHER_ID && request?.teacherName === DEFAULT_TEACHER_NAME, request);
  check("request carries no class / rollNumber", request?.className === undefined && request?.rollNumber === undefined, request);
  check("schoolName stored as informational text", request?.schoolName === "Riverside High", request);
  check("mine → pending + notification", request?.status === "pending" && mine.json.data.notifications.length > 0, mine.json?.data);
}

// 2. Duplicate email → 409.
{
  const r = await client().post("/registrations", validReg({ mobileNumber: "9111111111" }));
  check("duplicate email → 409", r.status === 409, r.status);
}

// 3. Invalid input → 400 (missing email; bad email; missing schoolName).
{
  check("missing email → 400", (await client().post("/registrations", validReg({ email: undefined }))).status === 400);
  check("invalid email → 400", (await client().post("/registrations", validReg({ email: "nope", mobileNumber: "9222222222" }))).status === 400);
  check("missing schoolName → 400", (await client().post("/registrations", { fullName: "X", email: "x@student.io", password: "Passw0rd!", mobileNumber: "9333333333" })).status === 400);
}

// 4. Unauthorized access — queue/decide require the right role.
{
  check("anon GET /registrations/queue → 401", (await client().get("/registrations/queue")).status === 401);
  check("student GET /registrations/queue → 403", (await student.get("/registrations/queue")).status === 403);
  check("student POST decide → 403", (await student.post(`/registrations/${studentReqId}/decide`, { decision: "approved" })).status === 403);
}

// 5. Ownership — the DEFAULT teacher sees it; another teacher does not.
const teacherB = client();
await teacherB.post("/auth/login", { login: "beta@school.io", password: teacherBPass });
{
  const q = await teacherB.get("/registrations/queue?status=pending");
  check("other teacher's queue excludes the auto-assigned student", !(q.json?.data?.requests ?? []).some((r: any) => r.id === studentReqId), q.json?.data?.total);
  const dec = await teacherB.post(`/registrations/${studentReqId}/decide`, { decision: "approved" });
  check("other teacher decide → authorization error", dec.status >= 400, dec.status);
}

// 6. Platform admin visibility — sees ALL requests.
{
  const q = await admin.get("/registrations/queue?status=pending&pageSize=100");
  check("platform admin sees the request (full visibility)", (q.json?.data?.requests ?? []).some((r: any) => r.id === studentReqId), q.json?.data?.total);
}

// 7. Approval — the default teacher approves; student becomes approved.
const defTeacher = client();
await defTeacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
{
  const q = await defTeacher.get("/registrations/queue?status=pending");
  check("default teacher sees the auto-assigned request", (q.json?.data?.requests ?? []).some((r: any) => r.id === studentReqId), q.json?.data?.total);
  const dec = await defTeacher.post(`/registrations/${studentReqId}/decide`, { decision: "approved" });
  check("default teacher approve → 200 approved", dec.status === 200 && dec.json?.data?.status === "approved", dec.json);
  const me = await student.get("/auth/me");
  check("approved student /auth/me → registrationStatus approved", me.json?.data?.registrationStatus === "approved", me.json?.data);
  const again = await defTeacher.post(`/registrations/${studentReqId}/decide`, { decision: "rejected" });
  check("re-deciding a decided request → error", again.status >= 400, again.status);
}

// 8. Rejection flow — a second student is rejected by the default teacher.
{
  const s2 = client();
  await s2.post("/registrations", validReg({ fullName: "Rex Reject", email: "rex@student.io", mobileNumber: "9444444444" }));
  const id2 = (await s2.get("/registrations/mine")).json?.data?.request?.id;
  const dec = await defTeacher.post(`/registrations/${id2}/decide`, { decision: "rejected", reason: "Incomplete details" });
  check("default teacher reject → 200 rejected + reason", dec.status === 200 && dec.json?.data?.status === "rejected" && dec.json?.data?.reason === "Incomplete details", dec.json?.data);
  const me = await s2.get("/auth/me");
  check("rejected student /auth/me → registrationStatus rejected", me.json?.data?.registrationStatus === "rejected", me.json?.data);
}

// 9. Pending-redirect behaviour (guardRedirect — the middleware decision).
{
  const pending: SessionPrincipal = { id: "s", role: "student", name: "S", email: "s@x", registrationStatus: "pending" };
  const rejected: SessionPrincipal = { id: "s", role: "student", name: "S", email: "s@x", registrationStatus: "rejected" };
  const approved: SessionPrincipal = { id: "s", role: "student", name: "S", email: "s@x", registrationStatus: "approved" };
  check("pending student → /student/dashboard redirects to /student/pending", guardRedirect("/student/dashboard", pending) === "/student/pending");
  check("pending student → /student/pending allowed", guardRedirect("/student/pending", pending) === null);
  check("rejected student → /learn/* redirects to /student/pending", guardRedirect("/learn/ai-course/lesson/x", rejected) === "/student/pending");
  check("approved student → /student/dashboard allowed", guardRedirect("/student/dashboard", approved) === null);
  check("approved student on /student/pending → dashboard", guardRedirect("/student/pending", approved) === "/student/dashboard");
}

// 10. Graceful failure when the default teacher is unavailable.
{
  await admin.post(`/admin/teachers/${DEFAULT_TEACHER_ID}/deactivate`);
  const r = await client().post("/registrations", validReg({ email: "noteacher@student.io", mobileNumber: "9555555555" }));
  check("default teacher missing → 503 (registration fails gracefully)", r.status === 503, r.status);
  check("503 returns a clear error message", typeof r.json?.error?.message === "string" && r.json.error.message.length > 0, r.json?.error);
  await admin.post(`/admin/teachers/${DEFAULT_TEACHER_ID}/activate`); // restore
}

console.log(`\nREGISTRATION CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
