// Verifies the Assessment Engine (Step 2): admin-only CRUD + publish, one
// assessment per module, student-facing answer-key stripping, MCQ auto-grading,
// pass/fail at 60%, open-ended participation credit, explanation review, and
// unauthorized access.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4103;
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
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b), patch: (p: string, b?: unknown) => req("PATCH", p, b), del: (p: string) => req("DELETE", p) };
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

console.log("[Assessment Engine checks]");
const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
const student = client();
await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
const teacher = client();
await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });

// Seed course + published module.
const courseId = (await admin.post("/admin/courses", { title: "Quiz Course", slug: "quiz-course" })).json.data.id;
const moduleId = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M1" })).json.data.id;
await admin.patch(`/admin/courses/modules/${moduleId}`, { isPublished: true });
await admin.post(`/admin/courses/${courseId}/publish`);

// 1. RBAC — only platform admins create assessments.
{
  check("student create assessment → 403", (await student.post("/admin/assessments", { moduleId, title: "X" })).status === 403);
  check("teacher create assessment → 403", (await teacher.post("/admin/assessments", { moduleId, title: "X" })).status === 403);
  check("anon create assessment → 401", (await client().post("/admin/assessments", { moduleId, title: "X" })).status === 401);
}

// 2. Create assessment (default passingScore 60), one-per-module.
let assessmentId = "";
{
  const r = await admin.post("/admin/assessments", { moduleId, title: "Module 1 Quiz" });
  assessmentId = r.json?.data?.id;
  check("create assessment → 201 passingScore 60", r.status === 201 && r.json?.data?.passingScore === 60, r.json?.data);
  const dup = await admin.post("/admin/assessments", { moduleId, title: "Again" });
  check("second assessment for module → 409", dup.status === 409, dup.status);
}

// 3. Questions (MCQ + reflection), each 1 mark → total 2.
let q1 = "", q2 = "";
{
  q1 = (await admin.post(`/admin/assessments/${assessmentId}/questions`, {
    type: "mcq", question: "2+2?", options: ["3", "4", "5"], correctAnswer: "4", explanation: "Basic math.", marks: 1,
  })).json.data.id;
  q2 = (await admin.post(`/admin/assessments/${assessmentId}/questions`, {
    type: "reflection", question: "What did you learn?", marks: 1,
  })).json.data.id;
  check("questions created", !!q1 && !!q2, { q1, q2 });
  check("invalid question type → 400", (await admin.post(`/admin/assessments/${assessmentId}/questions`, { type: "nope", question: "x" })).status === 400);
}

// 4. Student can't take an unpublished assessment.
{
  check("student GET unpublished assessment → 404", (await student.get(`/assessments/${assessmentId}`)).status === 404);
}

// 5. Publish → student view strips the answer key.
{
  const pub = await admin.post(`/admin/assessments/${assessmentId}/publish`);
  check("publish assessment → 200", pub.status === 200 && pub.json?.data?.isPublished === true, pub.json?.data);
  const view = await student.get(`/assessments/${assessmentId}`);
  const qs = view.json?.data?.questions ?? [];
  check("student assessment view → 200 with questions", view.status === 200 && qs.length === 2, qs.length);
  check("answer key hidden from students", qs.every((q: any) => q.correctAnswer === undefined && q.explanation === undefined), qs[0]);
}

// 6. Passing attempt (both correct/answered) → 100%, passed, review has explanations.
{
  const r = await student.post(`/assessments/${assessmentId}/attempt`, {
    answers: [{ questionId: q1, answer: "4" }, { questionId: q2, answer: "I learned a lot." }],
  });
  check("attempt → 201", r.status === 201, r.status);
  check("score 100, passed", r.json?.data?.attempt?.score === 100 && r.json?.data?.attempt?.passed === true, r.json?.data?.attempt);
  const review = r.json?.data?.review ?? [];
  check("review exposes correctAnswer + explanation", review.some((x: any) => x.explanation === "Basic math." && x.correctAnswer === "4"), review);
}

// 7. Failing attempt (MCQ wrong, reflection blank) → 0%, not passed.
{
  const r = await student.post(`/assessments/${assessmentId}/attempt`, {
    answers: [{ questionId: q1, answer: "3" }, { questionId: q2, answer: "" }],
  });
  check("wrong+blank attempt → score 0, failed", r.json?.data?.attempt?.score === 0 && r.json?.data?.attempt?.passed === false, r.json?.data?.attempt);
}

// 8. Partial (MCQ right, reflection blank) → 50% < 60% → fail.
{
  const r = await student.post(`/assessments/${assessmentId}/attempt`, {
    answers: [{ questionId: q1, answer: "4" }, { questionId: q2, answer: "" }],
  });
  check("50% attempt fails (below 60%)", r.json?.data?.attempt?.score === 50 && r.json?.data?.attempt?.passed === false, r.json?.data?.attempt);
}

// 9. Attempts history + student-only.
{
  const mine = await student.get(`/assessments/${assessmentId}/attempts`);
  check("student attempts history lists all 3", (mine.json?.data ?? []).length === 3, mine.json?.data?.length);
  check("teacher cannot attempt (student-only) → 403", (await teacher.post(`/assessments/${assessmentId}/attempt`, { answers: [] })).status === 403);
}

// 10. Delete assessment removes it.
{
  const del = await admin.del(`/admin/assessments/${assessmentId}`);
  check("delete assessment → 200", del.status === 200, del.status);
  check("student GET deleted assessment → 404", (await student.get(`/assessments/${assessmentId}`)).status === 404);
}

console.log(`\nASSESSMENT CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
