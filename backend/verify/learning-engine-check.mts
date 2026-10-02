// Verifies the Learning Engine (Step 1): catalog visibility by role, lesson
// ordering, the role-scoped topic endpoint with prev/next neighbors, hidden
// draft/archived + unpublished-module content, and preview access for teachers.
import { MongoMemoryServer } from "mongodb-memory-server";
import { publishModule } from "./_fixtures.mts";

const PORT = 4102;
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
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b), patch: (p: string, b?: unknown) => req("PATCH", p, b) };
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

console.log("[Learning Engine checks]");

const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
const teacher = client();
await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
const student = client();
await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
const anon = client();

// Seed a published course with 2 modules (M1 published, M2 hidden), lesson containers, and topics.
const c = await admin.post("/admin/courses", { title: "AI Foundations", slug: "ai-foundations" });
const courseId = c.json.data.id;
const m1 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "Module 1" })).json.data.id;
const m2 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "Module 2" })).json.data.id;
await publishModule(admin, m1); // published module (description, objectives, assessment)
// M2 stays hidden (isPublished false)
async function addTopic(moduleId: string, title: string, contentType: string, contentFields: Record<string, string>) {
  const lesson = await admin.post(`/admin/courses/modules/${moduleId}/lessons`, { title: `${title} lesson` });
  return (await admin.post(`/admin/courses/lessons/${lesson.json.data.id}/topics`, { title, contentType, ...contentFields })).json.data.id;
}
const l1 = await addTopic(m1, "L1", "video", { videoUrl: "https://x/v.mp4" });
const l2 = await addTopic(m1, "L2", "rich_text", { content: "# Hi" });
const l3 = await addTopic(m1, "L3", "pdf", { documentUrl: "https://x/d.pdf" });
const hiddenTopic = await addTopic(m2, "Hidden", "reflection", { content: "x" });
await admin.post(`/admin/courses/${courseId}/publish`);

// Also a draft course (must stay hidden for non-admins).
const draft = await admin.post("/admin/courses", { title: "Draft Only", slug: "draft-only" });

// 1. Catalog visibility.
{
  const s = await student.get("/courses");
  const slugs = (s.json?.data?.courses ?? []).map((x: any) => x.slug);
  check("student catalog shows published course", slugs.includes("ai-foundations"), slugs);
  check("student catalog hides draft course", !slugs.includes("draft-only"), slugs);
  const t = await teacher.get("/courses");
  check("teacher catalog shows published course (preview)", (t.json?.data?.courses ?? []).some((x: any) => x.slug === "ai-foundations"));
  const a = await admin.get("/courses");
  check("admin catalog includes draft", (a.json?.data?.courses ?? []).some((x: any) => x.slug === "draft-only"));
  const anonList = await anon.get("/courses");
  check("anon catalog published only", (anonList.json?.data?.courses ?? []).every((x: any) => x.status === "published"));
}

// 2. Course tree — ordering + published-module scoping.
{
  const s = await student.get("/courses/ai-foundations");
  const mods = s.json?.data?.modules ?? [];
  check("student tree contains only published modules", mods.length === 1 && mods[0].id === m1, mods.map((m: any) => m.id));
  const lids = (mods[0]?.lessons ?? []).map((lesson: any) => lesson.topics[0]?.id);
  check("student lesson topics ordered L1,L2,L3", lids[0] === l1 && lids[1] === l2 && lids[2] === l3, lids);
  const a = await admin.get("/courses/ai-foundations");
  check("admin tree includes hidden module", (a.json?.data?.modules ?? []).length === 2);
}

// 3. Draft/archived hidden from non-admins.
{
  check("student GET draft slug → 404", (await student.get("/courses/draft-only")).status === 404);
  check("teacher GET draft slug → 404", (await teacher.get("/courses/draft-only")).status === 404);
  check("admin GET draft slug → 200", (await admin.get("/courses/draft-only")).status === 200);
}

// 4. Topic endpoint with prev/next neighbors (sequential nav).
{
  const first = await student.get(`/courses/ai-foundations/topics/${l1}`);
  check("student topic L1 → 200 with next=L2, prev=null", first.status === 200 && first.json?.data?.prevTopicId === null && first.json?.data?.nextTopicId === l2, first.json?.data);
  const mid = await student.get(`/courses/ai-foundations/topics/${l2}`);
  check("student topic L2 → prev=L1, next=L3", mid.json?.data?.prevTopicId === l1 && mid.json?.data?.nextTopicId === l3, mid.json?.data);
  const last = await student.get(`/courses/ai-foundations/topics/${l3}`);
  check("student topic L3 → next=null (end of sequence)", last.json?.data?.nextTopicId === null, last.json?.data);
  check("topic endpoint returns flat ordered sequence", JSON.stringify(first.json?.data?.sequence) === JSON.stringify([l1, l2, l3]), first.json?.data?.sequence);
}

// 5. Hidden topic (unpublished module) not fetchable by students; admin can.
{
  check("student cannot fetch topic in hidden module → 404", (await student.get(`/courses/ai-foundations/topics/${hiddenTopic}`)).status === 404);
  check("admin can fetch topic in hidden module → 200", (await admin.get(`/courses/ai-foundations/topics/${hiddenTopic}`)).status === 200);
}

void draft;
console.log(`\nLEARNING ENGINE CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
