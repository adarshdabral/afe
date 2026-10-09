// Verifies course-content standardization: after seeding, "Demystifying AI for Everyone" is the
// ONLY course the platform returns; it has exactly the 12 required modules (ordered,
// published), each module has a lesson containing 7 topics and exactly ONE assessment with
// 10 MCQ + 5 True/False + 2 scenario questions; and every previously-existing
// course has been archived/removed from the catalog.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4113;
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
await (await import("./_server.mts")).startServer();
if (!(await up())) { console.error("not healthy"); process.exit(1); }
// Load server code only AFTER the env points at the test database (a static import
// would evaluate it first). The seed shares the app's mongoose connection.
const { seedAiCourse } = await import("../server/seed/course.seed.ts");

const REQUIRED_MODULES = [
  "Understanding Artificial Intelligence",
  "Data: The Foundation of AI",
  "How AI Learns",
  "AI in Everyday Life",
  "AI Across Industries and Public Systems",
  "AI in Education, Research and Creativity",
  "Building AI Projects",
  "AI Careers and Organizations",
  "AI and the Economy",
  "AI and the Future of Work",
  "Ethics, Safety and Responsible AI",
  "Future of AI and Capstone Project",
];
const TOPIC_TITLES = ["Overview", "Key Concepts", "Use Cases", "Best Practices", "Recent Developments", "Chapter Takeaways", "Suggested Learning Activities"];

console.log("[Course content standardization]");

const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
const student = client();
await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });

// Create some OTHER courses that must be wiped by standardization.
await admin.post("/admin/courses", { title: "Legacy Course One", slug: "legacy-one" });
const l2 = await admin.post("/admin/courses", { title: "Legacy Course Two", slug: "legacy-two" });
await admin.post(`/admin/courses/${l2.json.data.id}/publish`);

// Run the standardization seed.
const result = await seedAiCourse();
check("seed reports 12 modules + archived others", result.modules === 12 && result.archivedOthers >= 2, result);

// 1. Public catalog returns ONLY the AI course.
{
  const list = await student.get("/courses?pageSize=100");
  const courses = list.json?.data?.courses ?? [];
  check("catalog returns exactly ONE course", courses.length === 1, courses.map((c: any) => c.slug));
  const c = courses[0];
  check("the one course is 'Demystifying AI for Everyone' (demystifying-ai-for-everyone, published)", c?.slug === "demystifying-ai-for-everyone" && c?.title === "Demystifying AI for Everyone" && c?.status === "published", c);
  check("instructor is Dr. Sudhanshu Joshi", c?.instructor === "Dr. Sudhanshu Joshi", c?.instructor);
  check("legacy courses are not in the catalog", !courses.some((x: any) => x.slug === "legacy-one" || x.slug === "legacy-two"), courses.map((x: any) => x.slug));
}

// 2. Admin listing also shows only this live course.
{
  const all = await admin.get("/admin/courses?pageSize=100");
  const slugs = (all.json?.data?.courses ?? []).map((c: any) => c.slug);
  check("admin catalog contains no other live course", slugs.length === 1 && slugs[0] === "demystifying-ai-for-everyone", slugs);
}

// 3. Course tree: exactly 12 modules, ordered, matching the required titles.
const tree = (await student.get("/courses/demystifying-ai-for-everyone")).json?.data;
{
  const mods = tree?.modules ?? [];
  check("course has exactly 12 modules", mods.length === 12, mods.length);
  check("course page metadata seeded (skills, tools, offered by)", tree?.skills?.length > 0 && tree?.tools?.length > 0 && tree?.offeredBy?.name === "AI on Wheels", { skills: tree?.skills, tools: tree?.tools, offeredBy: tree?.offeredBy });
  const instructor = tree?.sections?.find((s: any) => s.kind === "instructor");
  check("instructor profile seeded", typeof instructor?.content === "string" && instructor.content.includes("PM Gati Shakti Centre of Excellence") && instructor.content.includes("technology-driven operations."), instructor?.content?.slice(0, 120));
  check("every module assessment has a time estimate", mods.every((m: any) => m.assessmentDurationMinutes > 0), mods.map((m: any) => m.assessmentDurationMinutes));
  check("modules are in ascending order 0..11", mods.every((m: any, i: number) => m.order === i), mods.map((m: any) => m.order));
  check("module titles match the required curriculum exactly", JSON.stringify(mods.map((m: any) => m.title)) === JSON.stringify(REQUIRED_MODULES), mods.map((m: any) => m.title));
  check("every module is published & has one lesson with 7 topics + assessment", mods.every((m: any) => m.isPublished && m.lessons.length === 1 && m.lessons[0].topics.length === 7 && !!m.assessmentId), mods.map((m: any) => ({ p: m.isPublished, l: m.lessons.length, t: m.lessons[0]?.topics?.length, a: !!m.assessmentId })));
  check("every module has a description and ≥3 learning objectives", mods.every((m: any) => m.description?.trim() && (m.learningObjectives ?? []).length >= 3 && m.learningObjectives.every((o: string) => o.trim())), mods.map((m: any) => ({ t: m.title, d: !!m.description, o: m.learningObjectives?.length })));
  const adminMods = (await admin.get(`/admin/courses/${tree?.id}`)).json?.data?.modules ?? [];
  check("every seeded module meets the publish rules (admin readiness.ready)", adminMods.length === 12 && adminMods.every((m: any) => m.readiness?.ready === true), adminMods.filter((m: any) => !m.readiness?.ready).map((m: any) => ({ t: m.title, missing: m.readiness?.missing })));
}

// 4. Each module's lesson contains all seven required topic sections. Topic bodies
//    are only in the staff tree (learners' trees carry no content).
{
  const staffTree = (await admin.get("/courses/demystifying-ai-for-everyone")).json?.data;
  const allHaveTopics = (staffTree?.modules ?? []).every((m: any) => {
    const topics = m.lessons?.[0]?.topics ?? [];
    return topics.length === TOPIC_TITLES.length && topics.every((topic: any, i: number) => topic.title === TOPIC_TITLES[i] && topic.content.trim().length > 0);
  });
  check("every lesson contains the 7 required content topics in order", allHaveTopics, (tree?.modules ?? []).map((m: any) => m.lessons?.[0]?.topics?.map((t: any) => t.title)));
}

// 5. Each module has exactly ONE assessment with 10 MCQ + 5 True/False + 2 scenario.
{
  let ok = true;
  const detail: any[] = [];
  for (const m of tree?.modules ?? []) {
    const view = await admin.get(`/admin/assessments/${m.assessmentId}`);
    const qs = view.json?.data?.questions ?? [];
    const isTF = (q: any) => q.type === "mcq" && q.options.length === 2 && q.options.includes("True") && q.options.includes("False");
    const mcq = qs.filter((q: any) => q.type === "mcq" && !isTF(q)).length;
    const tf = qs.filter(isTF).length;
    const scenario = qs.filter((q: any) => q.type === "scenario").length;
    const good = qs.length === 17 && mcq === 10 && tf === 5 && scenario === 2;
    if (!good) { ok = false; detail.push({ module: m.title, total: qs.length, mcq, tf, scenario }); }
  }
  check("every module assessment = 10 MCQ + 5 True/False + 2 scenario (17)", ok, detail);
}

// 6. Answer key is hidden from students; a student can attempt module 1's quiz.
{
  const m1 = tree.modules[0];
  // The module assessment opens once the module's lessons are done (learning sequence).
  check("module 1 assessment locked before its lessons → 403", (await student.get(`/assessments/${m1.assessmentId}`)).status === 403);
  for (const t of m1.lessons[0].topics) await student.post(`/progress/${tree.id}/topics/${t.id}/complete`);
  const view = await student.get(`/assessments/${m1.assessmentId}`);
  check("student assessment view hides answer key", (view.json?.data?.questions ?? []).every((q: any) => q.correctAnswer === undefined && q.explanation === undefined), view.json?.data?.questions?.[0]);
  const q1 = view.json.data.questions[0];
  const attempt = await student.post(`/assessments/${m1.assessmentId}/attempt`, { answers: [{ questionId: q1.id, answer: q1.options[0] }] });
  check("student can submit an attempt (graded)", attempt.status === 201 && typeof attempt.json?.data?.attempt?.score === "number", attempt.status);
}

console.log(`\nCOURSE CONTENT CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
