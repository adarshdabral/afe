// Verifies the course-overview metadata and the per-student module summary:
//  - Course instructorTitle / skills / tools / offeredBy: admin write (validated,
//    chips trimmed + de-duplicated, offeredBy merged), public read, student 403.
//  - Assessment estimatedDurationMinutes → course tree `assessmentDurationMinutes`.
//  - "X graded assignments left · Y lessons left · Z left" is computed from the
//    module content + each student's own progress (frontend lib/progress.ts
//    `moduleRemaining`, run here against live API data): two students on the same
//    module see different values, and the values move as topics are completed and
//    the assessment is passed (a failed attempt does not count).
import { MongoMemoryServer } from "mongodb-memory-server";
import { publishModule } from "./_fixtures.mts";
import { moduleRemaining } from "../../frontend/lib/progress.ts";

const PORT = 4121;
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

console.log("[Course overview + module summary checks]");
const admin = client();
await admin.login("Moocs@admin", "Admin@123");
const alice = client();
await alice.login("student@afe.edu", "Student@123");
const bob = client();
const reg = await bob.post("/registrations", { fullName: "Bob Learner", email: "bob@student.io", password: "Passw0rd!", mobileNumber: "9998887777", schoolName: "Riverside High" });
check("second student registered (approved by default)", reg.status === 201 && reg.json?.data?.registrationStatus === "approved", reg.json?.data);

// ── Course metadata ──────────────────────────────────────────────────────────
const created = await admin.post("/admin/courses", {
  title: "Overview Course",
  slug: "overview-course",
  instructor: "Dr. Sudhanshu Joshi",
  skills: ["AI literacy", "  Data literacy ", "AI literacy"],
  tools: ["AI copilots"],
  offeredBy: { name: "Doon University", description: "Centre of Excellence" },
});
const courseId = created.json?.data?.id;
check("create course with metadata → 201", created.status === 201, created.json);
check("skills trimmed + de-duplicated", JSON.stringify(created.json?.data?.skills) === JSON.stringify(["AI literacy", "Data literacy"]), created.json?.data?.skills);
check("offeredBy defaults missing keys to ''", created.json?.data?.offeredBy?.url === "" && created.json?.data?.offeredBy?.logoUrl === "", created.json?.data?.offeredBy);
check("instructorTitle defaults to ''", created.json?.data?.instructorTitle === "");

const patched = await admin.patch(`/admin/courses/${courseId}`, { instructorTitle: "Course lead", tools: ["AI copilots", "MLOps tools"], offeredBy: { url: "https://doonuniversity.ac.in" } });
check("PATCH metadata → 200", patched.status === 200, patched.json);
check("offeredBy PATCH merges (name kept, url set)", patched.json?.data?.offeredBy?.name === "Doon University" && patched.json?.data?.offeredBy?.url === "https://doonuniversity.ac.in", patched.json?.data?.offeredBy);
check("empty chip rejected → 400", (await admin.patch(`/admin/courses/${courseId}`, { skills: ["ok", "  "] })).status === 400);
check("too many chips rejected → 400", (await admin.patch(`/admin/courses/${courseId}`, { tools: Array.from({ length: 31 }, (_, i) => `t${i}`) })).status === 400);
check("student cannot PATCH course → 403", (await alice.patch(`/admin/courses/${courseId}`, { skills: ["x"] })).status === 403);

// ── Content: M1 = 3 topics (5, 10, 0 min) + assessment (15 min); M2 = 1 topic ──
const m1 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M1" })).json.data.id;
const m2 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M2" })).json.data.id;
async function topic(moduleId: string, title: string, minutes: number) {
  const lesson = await admin.post(`/admin/courses/modules/${moduleId}/lessons`, { title: `${title} lesson` });
  return (await admin.post(`/admin/courses/lessons/${lesson.json.data.id}/topics`, { title, contentType: "rich_text", content: title, estimatedDurationMinutes: minutes })).json.data.id;
}
const T1 = await topic(m1, "T1", 5);
const T2 = await topic(m1, "T2", 10);
await topic(m1, "T3", 0); // no estimate: counts as a lesson, adds no time
await topic(m2, "T4", 7);
// A GRADED lesson assignment after T1's lesson (6 min) — counted as a graded item.
const t1Lesson = (await admin.get(`/admin/courses/${courseId}`)).json.data.modules[0].lessons[0].id;
const A = (await admin.post("/admin/assessments", { lessonId: t1Lesson, title: "T1 assignment", isGraded: true, estimatedDurationMinutes: 6 })).json.data.id;
await admin.post(`/admin/assessments/${A}/questions`, { type: "mcq", question: "?", options: ["Yes", "No"], correctAnswer: "Yes", marks: 1 });
await admin.post(`/admin/assessments/${A}/publish`);
const a1 = await publishModule(admin, m1);
await publishModule(admin, m2);
const setEst = await admin.patch(`/admin/assessments/${a1}`, { estimatedDurationMinutes: 15 });
check("assessment estimatedDurationMinutes PATCH → 15", setEst.status === 200 && setEst.json?.data?.estimatedDurationMinutes === 15, setEst.json);
check("negative estimate → 400", (await admin.patch(`/admin/assessments/${a1}`, { estimatedDurationMinutes: -1 })).status === 400);
await admin.post(`/admin/courses/${courseId}/publish`);

// ── Public tree ──────────────────────────────────────────────────────────────
const pub = await client().get(`/courses/overview-course`);
const tree = pub.json?.data;
check("public tree carries metadata", tree?.instructorTitle === "Course lead" && tree?.skills?.length === 2 && tree?.tools?.includes("MLOps tools") && tree?.offeredBy?.name === "Doon University", tree && { instructorTitle: tree.instructorTitle, skills: tree.skills, tools: tree.tools, offeredBy: tree.offeredBy });
const M1 = tree?.modules?.find((m: any) => m.id === m1);
const M2 = tree?.modules?.find((m: any) => m.id === m2);
check("module node: assessmentDurationMinutes = 15", M1?.assessmentDurationMinutes === 15, M1?.assessmentDurationMinutes);
check("module without an estimate → 0", M2?.assessmentDurationMinutes === 0, M2?.assessmentDurationMinutes);

async function summary(student: ReturnType<typeof client>, mod: any) {
  const p = (await student.get(`/progress/${courseId}`)).json?.data?.progress;
  const passed = new Set<string>((p?.assessmentScores ?? []).filter((a: any) => a.passed).map((a: any) => a.assessmentId));
  const r = moduleRemaining(mod, new Set(p?.completedTopics ?? []), passed);
  return { graded: r.gradedLeft, lessons: r.lessonsLeft, minutes: r.minutesLeft };
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── Per-student, live (sequence: T1 → graded assignment A → T2 → T3 → module assessment)
{
  const s = await summary(alice, M1);
  check("tree lists the lesson assignment", M1?.lessons?.[0]?.assignments?.[0]?.id === A && M1.lessons[0].assignments[0].isGraded === true, M1?.lessons?.[0]?.assignments);
  check("fresh student: 2 graded · 3 lessons · 36m left", eq(s, { graded: 2, lessons: 3, minutes: 36 }), s);
}
await alice.post(`/progress/${courseId}/topics/${T1}/complete`);
{
  const a = await summary(alice, M1);
  const b = await summary(bob, M1);
  check("after T1: alice 2 · 2 lessons · 31m", eq(a, { graded: 2, lessons: 2, minutes: 31 }), a);
  check("bob on the same module is unaffected (2 · 3 · 36m)", eq(b, { graded: 2, lessons: 3, minutes: 36 }), b);
}
check("T2 locked until the lesson assignment is done", (await alice.post(`/progress/${courseId}/topics/${T2}/complete`)).status === 409);
const aQ = (await admin.get(`/admin/assessments/lesson/${t1Lesson}`)).json.data.questions[0].id;
await alice.post(`/assessments/${A}/attempt`, { answers: [{ questionId: aQ, answer: "Yes" }] });
{
  const a = await summary(alice, M1);
  check("graded assignment passed: 1 · 2 lessons · 25m", eq(a, { graded: 1, lessons: 2, minutes: 25 }), a);
}
await alice.post(`/progress/${courseId}/topics/${T2}/complete`);
const T3 = M1.lessons[2].topics[0].id;
await alice.post(`/progress/${courseId}/topics/${T3}/complete`);
const qId = (await admin.get(`/admin/assessments/module/${m1}`)).json.data.questions[0].id;
await alice.post(`/assessments/${a1}/attempt`, { answers: [{ questionId: qId, answer: "No" }] });
{
  const a = await summary(alice, M1);
  check("failed module assessment still left (1 · 0 lessons · 15m)", eq(a, { graded: 1, lessons: 0, minutes: 15 }), a);
}
await alice.post(`/assessments/${a1}/attempt`, { answers: [{ questionId: qId, answer: "Yes" }] });
{
  const a = await summary(alice, M1);
  check("passed: nothing left (0 · 0 · 0m)", eq(a, { graded: 0, lessons: 0, minutes: 0 }), a);
  const m2s = await summary(alice, M2);
  check("other module unchanged for alice (1 · 1 · 7m)", eq(m2s, { graded: 1, lessons: 1, minutes: 7 }), m2s);
}

// ── Existing courses still work: a course with no metadata ─────────────────────
{
  const bare = await admin.post("/admin/courses", { title: "Bare Course" });
  check("course without metadata → empty skills/tools/offeredBy", bare.status === 201 && eq(bare.json?.data?.skills, []) && eq(bare.json?.data?.tools, []) && bare.json?.data?.offeredBy?.name === "", bare.json?.data);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log("Failures:\n - " + failures.join("\n - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
