// Verifies Progress Tracking (Step 3): persistence, sequential lesson locking,
// module completion, overall %, assessment → progress wiring, course completion
// (100% lessons + assessments passed → certificateEligible), time tracking, and
// unauthorized access.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4104;
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
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b), patch: (p: string, b?: unknown) => req("PATCH", p, b), login: (l: string, pw: string) => req("POST", "/auth/login", { login: l, password: pw }) };
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
await (await import("./_server.mts")).startServer();
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }

console.log("[Progress Tracking checks]");
const admin = client();
await admin.login("Moocs@admin", "Admin@123");
const student = client();
await student.login("student@afe.edu", "Student@123");
const teacher = client();
await teacher.login("teacher@afe.edu", "Teacher@123");

// Seed: course, 2 published modules (M1: L1,L2 · M2: L3,L4), published assessment on M1.
const courseId = (await admin.post("/admin/courses", { title: "Progress Course", slug: "progress-course" })).json.data.id;
const m1 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M1" })).json.data.id;
const m2 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M2" })).json.data.id;
await admin.patch(`/admin/courses/modules/${m1}`, { isPublished: true });
await admin.patch(`/admin/courses/modules/${m2}`, { isPublished: true });
const L1 = (await admin.post(`/admin/courses/modules/${m1}/lessons`, { title: "L1", contentType: "rich_text", content: "a" })).json.data.id;
const L2 = (await admin.post(`/admin/courses/modules/${m1}/lessons`, { title: "L2", contentType: "rich_text", content: "b" })).json.data.id;
const L3 = (await admin.post(`/admin/courses/modules/${m2}/lessons`, { title: "L3", contentType: "rich_text", content: "c" })).json.data.id;
const L4 = (await admin.post(`/admin/courses/modules/${m2}/lessons`, { title: "L4", contentType: "rich_text", content: "d" })).json.data.id;
await admin.post(`/admin/courses/${courseId}/publish`);
const assessmentId = (await admin.post("/admin/assessments", { moduleId: m1, title: "M1 Quiz" })).json.data.id;
const q = (await admin.post(`/admin/assessments/${assessmentId}/questions`, { type: "mcq", question: "?", options: ["A", "B"], correctAnswer: "A", marks: 1 })).json.data.id;
await admin.post(`/admin/assessments/${assessmentId}/publish`);

const cp = (path: string, body?: unknown) => student.post(`/progress/${courseId}${path}`, body);

// 1. Initial progress + unauthorized.
{
  const g = await student.get(`/progress/${courseId}`);
  check("initial progress → overall 0, next L1", g.status === 200 && g.json?.data?.progress?.overallProgress === 0 && g.json?.data?.nextLessonId === L1, g.json?.data);
  check("teacher GET progress → 403", (await teacher.get(`/progress/${courseId}`)).status === 403);
  check("anon GET progress → 401", (await client().get(`/progress/${courseId}`)).status === 401);
}

// 2. Sequential locking.
{
  const locked = await cp(`/lessons/${L2}/complete`);
  check("complete L2 before L1 → 409 locked", locked.status === 409, locked.status);
  const bad = await cp(`/lessons/not-a-lesson/complete`);
  check("complete unknown lesson → 404", bad.status === 404, bad.status);
}

// 3. Complete L1 → 25%, module not yet complete.
{
  const r = await cp(`/lessons/${L1}/complete`);
  check("complete L1 → 200, overall 25", r.status === 200 && r.json?.data?.progress?.overallProgress === 25, r.json?.data?.progress);
  check("L1 lastVisited + next=L2", r.json?.data?.progress?.lastVisitedLessonId === L1 && r.json?.data?.nextLessonId === L2, r.json?.data);
  check("M1 not complete yet", !(r.json?.data?.progress?.completedModules ?? []).includes(m1), r.json?.data?.progress?.completedModules);
}

// 4. Complete L2 → M1 complete, 50%.
{
  const r = await cp(`/lessons/${L2}/complete`);
  check("complete L2 → overall 50, M1 complete", r.json?.data?.progress?.overallProgress === 50 && (r.json?.data?.progress?.completedModules ?? []).includes(m1), r.json?.data?.progress);
}

// 5. Complete L3, L4 → 100% lessons, both modules complete.
{
  await cp(`/lessons/${L3}/complete`);
  const r = await cp(`/lessons/${L4}/complete`);
  const p = r.json?.data?.progress;
  check("all lessons complete → overall 100", p?.overallProgress === 100 && r.json?.data?.nextLessonId === null, p);
  check("both modules complete", (p?.completedModules ?? []).includes(m1) && (p?.completedModules ?? []).includes(m2), p?.completedModules);
  check("NOT certificate-eligible yet (assessment unpassed)", p?.certificateEligible === false, p);
}

// 6. Pass the mandatory assessment → certificate eligible.
{
  const a = await student.post(`/assessments/${assessmentId}/attempt`, { answers: [{ questionId: q, answer: "A" }] });
  check("assessment passed", a.json?.data?.attempt?.passed === true, a.json?.data?.attempt);
  const g = await student.get(`/progress/${courseId}`);
  check("100% lessons + assessment passed → certificateEligible true", g.json?.data?.progress?.certificateEligible === true, g.json?.data?.progress);
  check("assessment score recorded in progress", (g.json?.data?.progress?.assessmentScores ?? []).some((s: any) => s.assessmentId === assessmentId && s.passed), g.json?.data?.progress?.assessmentScores);
}

// 7. Persistence across a fresh session.
{
  const fresh = client();
  await fresh.login("student@afe.edu", "Student@123");
  const g = await fresh.get(`/progress/${courseId}`);
  check("progress persists across sessions", g.json?.data?.progress?.overallProgress === 100 && g.json?.data?.progress?.certificateEligible === true, g.json?.data?.progress);
  const all = await fresh.get(`/progress`);
  check("student progress list includes the course", (all.json?.data ?? []).some((p: any) => p.courseId === courseId), all.json?.data?.length);
}

// 8. Time tracking.
{
  await cp(`/time`, { minutes: 30 });
  const r = await cp(`/time`, { minutes: 15 });
  check("time accumulates to 45 min", r.json?.data?.progress?.timeSpentMinutes === 45, r.json?.data?.progress?.timeSpentMinutes);
}

console.log(`\nPROGRESS CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
