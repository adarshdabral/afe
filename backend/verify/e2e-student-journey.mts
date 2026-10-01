// END-TO-END student journey (as a real user): registration → login (email+
// session) → dashboard APIs → course discovery → ordered learning → sequential
// unlocking → assessment scoring → progress tracking → course completion →
// auto-issued certificate → download PDF → public verification.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4110;
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
  async function raw(path: string) {
    const headers: Record<string, string> = {}; if (cookie) headers["cookie"] = cookie;
    const res = await fetch(`${BASE}${path}`, { headers });
    const bytes = (await res.arrayBuffer().catch(() => new ArrayBuffer(0))).byteLength;
    return { status: res.status, contentType: res.headers.get("content-type") ?? "", bytes };
  }
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b), patch: (p: string, b?: unknown) => req("PATCH", p, b), raw, hasCookie: () => !!cookie };
}
async function up(t = 20000) { const s = Date.now(); while (Date.now()-s<t){try{if((await fetch(`${BASE}/health`)).ok)return true}catch{}await new Promise(r=>setTimeout(r,250))} return false; }

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
delete process.env.REQUIRE_TEACHER_APPROVAL; // default: approved immediately
await import("../src/index.ts");
if (!(await up())) { console.error("not healthy"); process.exit(1); }

console.log("[E2E student journey]");

// ---- Setup: admin builds a published course (1 module, 3 lessons, 1 quiz) + a draft ----
const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
const courseId = (await admin.post("/admin/courses", { title: "QA Course", slug: "qa-course", shortDescription: "For QA" })).json.data.id;
const m1 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "Module 1" })).json.data.id;
await admin.patch(`/admin/courses/modules/${m1}`, { isPublished: true });
const L1 = (await admin.post(`/admin/courses/modules/${m1}/lessons`, { title: "Lesson 1", contentType: "rich_text", content: "# Intro" })).json.data.id;
const L2 = (await admin.post(`/admin/courses/modules/${m1}/lessons`, { title: "Lesson 2", contentType: "video", videoUrl: "https://x/v.mp4" })).json.data.id;
const L3 = (await admin.post(`/admin/courses/modules/${m1}/lessons`, { title: "Lesson 3", contentType: "pdf", documentUrl: "https://x/d.pdf" })).json.data.id;
const aId = (await admin.post("/admin/assessments", { moduleId: m1, title: "M1 Quiz" })).json.data.id;
const q1 = (await admin.post(`/admin/assessments/${aId}/questions`, { type: "mcq", question: "2+2?", options: ["3","4"], correctAnswer: "4", explanation: "Maths.", marks: 1 })).json.data.id;
await admin.post(`/admin/assessments/${aId}/publish`);
await admin.post(`/admin/courses/${courseId}/publish`);
const draftId = (await admin.post("/admin/courses", { title: "Draft QA", slug: "draft-qa" })).json.data.id;
const teacherId = (await admin.get("/registrations/directory")).json.data.teachers[0].id;

// ---- 1. Registration ----
console.log("[1] Registration");
const s = client();
{
  const r = await s.post("/registrations", { fullName: "Quinn Tester", email: "quinn@qa.io", password: "Passw0rd!", mobileNumber: "9008007001", schoolName: "QA High" });
  check("register new student → 201", r.status === 201, r.status);
  check("account created & session cookie set", s.hasCookie() && !!r.json?.data?.id, r.json?.data?.id);
  check("registrationStatus = approved (default)", r.json?.data?.registrationStatus === "approved", r.json?.data);
}

// ---- 2. Login (email) + session + /me ----
console.log("[2] Login + session");
{
  const c = client();
  const r = await c.post("/auth/login", { login: "quinn@qa.io", password: "Passw0rd!" });
  check("login by email → 200 role student", r.status === 200 && r.json?.data?.role === "student", r.json?.data);
  check("JWT session cookie set", c.hasCookie());
  const me = await c.get("/auth/me");
  check("GET /auth/me → student, approved", me.json?.data?.role === "student" && me.json?.data?.registrationStatus === "approved", me.json?.data);
}

// ---- 3. Dashboard APIs ----
console.log("[3] Dashboard data");
{
  const prog = await s.get("/progress");
  check("dashboard: my progress list (empty at start)", prog.status === 200 && Array.isArray(prog.json?.data) && prog.json.data.length === 0, prog.json?.data);
}

// ---- 4. Course discovery ----
console.log("[4] Course discovery");
{
  const list = await s.get("/courses");
  const slugs = (list.json?.data?.courses ?? []).map((c: any) => c.slug);
  check("catalog shows published course", slugs.includes("qa-course"), slugs);
  check("catalog hides draft course", !slugs.includes("draft-qa"), slugs);
  const search = await s.get("/courses?search=QA");
  check("search finds the course", (search.json?.data?.courses ?? []).some((c: any) => c.slug === "qa-course"), search.json?.data?.total);
  const detail = await s.get("/courses/qa-course");
  check("open course details → tree with 1 module, 3 lessons", detail.status === 200 && (detail.json?.data?.modules?.[0]?.lessons?.length === 3), detail.json?.data?.modules?.length);
}

// ---- 5. Learning flow (ordering + locking) ----
console.log("[5] Learning flow");
{
  const first = await s.get(`/courses/qa-course/lessons/${L1}`);
  check("open first lesson → prev=null next=L2", first.json?.data?.prevLessonId === null && first.json?.data?.nextLessonId === L2, first.json?.data);
  check("flat lesson order is L1,L2,L3", JSON.stringify(first.json?.data?.sequence) === JSON.stringify([L1, L2, L3]), first.json?.data?.sequence);
  const lockedComplete = await s.post(`/progress/${courseId}/lessons/${L2}/complete`);
  check("next lesson locked until previous complete → 409", lockedComplete.status === 409, lockedComplete.status);
}

// ---- 6. Sequential learning ----
console.log("[6] Sequential learning");
{
  const c1 = await s.post(`/progress/${courseId}/lessons/${L1}/complete`);
  check("complete L1 → 200, next unlocks to L2", c1.status === 200 && c1.json?.data?.nextLessonId === L2, c1.json?.data);
  const c2 = await s.post(`/progress/${courseId}/lessons/${L2}/complete`);
  check("complete L2 → next L3", c2.json?.data?.nextLessonId === L3, c2.json?.data);
  const c3 = await s.post(`/progress/${courseId}/lessons/${L3}/complete`);
  check("complete L3 → module lessons done (next=null)", c3.json?.data?.nextLessonId === null, c3.json?.data);
  check("module marked complete", (c3.json?.data?.progress?.completedModules ?? []).includes(m1), c3.json?.data?.progress?.completedModules);
}

// ---- 7. Assessment ----
console.log("[7] Assessment");
{
  const view = await s.get(`/assessments/${aId}`);
  check("open assessment (answer key hidden)", view.status === 200 && view.json?.data?.questions?.[0]?.correctAnswer === undefined, view.json?.data?.questions?.[0]);
  const wrong = await s.post(`/assessments/${aId}/attempt`, { answers: [{ questionId: q1, answer: "3" }] });
  check("wrong answer → score 0, failed", wrong.json?.data?.attempt?.score === 0 && wrong.json?.data?.attempt?.passed === false, wrong.json?.data?.attempt);
  const right = await s.post(`/assessments/${aId}/attempt`, { answers: [{ questionId: q1, answer: "4" }] });
  check("correct answer → score 100, passed", right.json?.data?.attempt?.score === 100 && right.json?.data?.attempt?.passed === true, right.json?.data?.attempt);
  check("explanations visible after submit", (right.json?.data?.review ?? []).some((r: any) => r.explanation === "Maths."), right.json?.data?.review);
}

// ---- 8. Progress tracking ----
console.log("[8] Progress tracking");
{
  const p = (await s.get(`/progress/${courseId}`)).json?.data?.progress;
  check("completedLessons updated (3)", (p?.completedLessons ?? []).length === 3, p?.completedLessons);
  check("completedModules updated (1)", (p?.completedModules ?? []).includes(m1), p?.completedModules);
  check("overallProgress = 100", p?.overallProgress === 100, p?.overallProgress);
  check("lastVisitedLessonId set", p?.lastVisitedLessonId === L3, p?.lastVisitedLessonId);
}

// ---- 8b. Time tracking (heartbeat persistence) ----
console.log("[8b] Time tracking");
{
  await s.post(`/progress/${courseId}/time`, { minutes: 12 });
  await s.post(`/progress/${courseId}/time`, { minutes: 8 });
  const p = (await s.get(`/progress/${courseId}`)).json?.data?.progress;
  check("time tracking persists (timeSpentMinutes accumulates to 20)", p?.timeSpentMinutes === 20, p?.timeSpentMinutes);
}

// ---- 9. Course completion + certificate eligibility ----
console.log("[9] Course completion");
{
  const p = (await s.get(`/progress/${courseId}`)).json?.data?.progress;
  check("course complete → certificateEligible = true", p?.overallProgress === 100 && p?.certificateEligible === true, p);
}

// ---- 10. Certificate ----
console.log("[10] Certificate");
{
  const mine = await s.get("/certificates/mine");
  const cert = (mine.json?.data ?? [])[0];
  check("certificate auto-generated", (mine.json?.data ?? []).length === 1 && /^AFE-\d{4}-[0-9A-F]{8}$/.test(cert?.certificateId ?? ""), cert?.certificateId);
  check("student views certificate (course + status)", cert?.courseTitle === "QA Course" && cert?.status === "active", cert);
  const dl = await s.raw(`/certificates/${cert.certificateId}/download`);
  check("download certificate PDF → application/pdf", dl.status === 200 && dl.contentType.includes("application/pdf") && dl.bytes > 500, dl);
  const v = await client().get(`/certificates/verify/${cert.certificateId}`);
  check("public verification works → valid:true", v.status === 200 && v.json?.data?.valid === true && v.json?.data?.certificate?.courseTitle === "QA Course", v.json?.data);
}

void draftId; void L3;
console.log(`\nE2E STUDENT JOURNEY: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
