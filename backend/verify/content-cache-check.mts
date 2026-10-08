// Verifies the content cache (server/cache/content-cache.ts) never serves stale
// content: after warming the public course tree, the topic endpoint, the student's
// progress sequence and branding, EVERY kind of admin write must be visible on the
// very next read — course PATCH, section PATCH, topic PATCH/create/delete, module
// reorder/unpublish, assessment unpublish/publish, branding PUT, course unpublish.
import { MongoMemoryServer } from "mongodb-memory-server";
import { publishModule } from "./_fixtures.mts";

const PORT = 4122;
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
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b), patch: (p: string, b?: unknown) => req("PATCH", p, b), put: (p: string, b?: unknown) => req("PUT", p, b), del: (p: string) => req("DELETE", p), login: (l: string, pw: string) => req("POST", "/auth/login", { login: l, password: pw }) };
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

console.log("[Content cache invalidation checks]");
const admin = client();
await admin.login("Moocs@admin", "Admin@123");
const student = client();
await student.login("student@afe.edu", "Student@123");
const anon = client();

const SLUG = "cache-course";
const courseId = (await admin.post("/admin/courses", { title: "Cache Course", slug: SLUG })).json.data.id;
const m1 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M1" })).json.data.id;
const m2 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M2" })).json.data.id;
const l1 = (await admin.post(`/admin/courses/modules/${m1}/lessons`, { title: "L1" })).json.data.id;
const l2 = (await admin.post(`/admin/courses/modules/${m2}/lessons`, { title: "L2" })).json.data.id;
const t1 = (await admin.post(`/admin/courses/lessons/${l1}/topics`, { title: "T1", contentType: "rich_text", content: "one" })).json.data.id;
const t2 = (await admin.post(`/admin/courses/lessons/${l2}/topics`, { title: "T2", contentType: "rich_text", content: "two" })).json.data.id;
const a1 = await publishModule(admin, m1);
await publishModule(admin, m2);
await admin.post(`/admin/courses/${courseId}/publish`);

const tree = async () => (await anon.get(`/courses/${SLUG}`)).json?.data;
const titles = (t: any) => t?.modules?.map((m: any) => m.title);
const allTopics = (t: any) => t?.modules?.flatMap((m: any) => m.lessons.flatMap((l: any) => l.topics.map((x: any) => x.title)));

// Warm every cached read twice.
for (let i = 0; i < 2; i++) {
  await tree();
  await student.get(`/courses/${SLUG}/topics/${t1}`);
  await student.get(`/progress/${courseId}`);
  await anon.get("/branding");
}
check("warm tree has M1, M2", JSON.stringify(titles(await tree())) === JSON.stringify(["M1", "M2"]), titles(await tree()));

// Course + section edits.
await admin.patch(`/admin/courses/${courseId}`, { shortDescription: "Fresh summary", skills: ["Caching"] });
{
  const t = await tree();
  check("course PATCH visible immediately", t?.shortDescription === "Fresh summary" && t?.skills?.[0] === "Caching", { s: t?.shortDescription, k: t?.skills });
}
await admin.patch(`/admin/courses/${courseId}/sections/overview`, { content: "Overview body" });
check("section PATCH visible immediately", (await tree())?.sections?.find((s: any) => s.kind === "overview")?.content === "Overview body");

// Topic edits: tree + topic endpoint + progress sequence.
await admin.patch(`/admin/courses/topics/${t1}`, { title: "T1 renamed", content: "one v2" });
check("topic PATCH visible in tree", allTopics(await tree())?.includes("T1 renamed"), allTopics(await tree()));
{
  const tp = (await student.get(`/courses/${SLUG}/topics/${t1}`)).json?.data;
  check("topic PATCH visible on topic endpoint", tp?.topic?.title === "T1 renamed" && tp?.topic?.content === "one v2", tp?.topic);
}
const t3 = (await admin.post(`/admin/courses/lessons/${l1}/topics`, { title: "T3", contentType: "rich_text", content: "three" })).json.data.id;
check("new topic visible in tree", allTopics(await tree())?.includes("T3"), allTopics(await tree()));
{
  const p = (await student.get(`/progress/${courseId}`)).json?.data;
  check("new topic counted in progress sequence", p?.totalTopics === 3, p?.totalTopics);
  const done = await student.post(`/progress/${courseId}/topics/${t1}/complete`);
  check("next topic after T1 is the new T3 (sequence refreshed)", done.json?.data?.nextTopicId === t3, done.json?.data?.nextTopicId);
}
await admin.del(`/admin/courses/topics/${t3}`);
check("deleted topic gone from tree", !allTopics(await tree())?.includes("T3"), allTopics(await tree()));
check("deleted topic gone from progress sequence", (await student.get(`/progress/${courseId}`)).json?.data?.totalTopics === 2);

// Outline view: topic text omitted, everything else present; the topic endpoint has the body.
{
  const o = (await anon.get(`/courses/${SLUG}?view=outline`)).json?.data;
  const topics = o?.modules?.flatMap((m: any) => m.lessons.flatMap((l: any) => l.topics)) ?? [];
  check("outline view: topic bodies omitted, titles kept", topics.length === 2 && topics.every((t: any) => t.content === "" && t.title), topics.map((t: any) => ({ t: t.title, c: t.content })));
  check("outline view keeps section content", o?.sections?.find((x: any) => x.kind === "overview")?.content === "Overview body");
  const staff = (await admin.get(`/courses/${SLUG}`)).json?.data;
  check("staff full view (default) still carries topic bodies", staff?.modules?.[0]?.lessons?.[0]?.topics?.[0]?.content !== "");
  check("learner view never carries topic bodies", (await tree())?.modules?.every((m: any) => m.lessons.every((l: any) => l.topics.every((t: any) => t.content === ""))));
  check("bad view value → 400", (await anon.get(`/courses/${SLUG}?view=nope`)).status === 400);
}

// Module reorder + visibility.
await admin.post(`/admin/courses/${courseId}/modules/reorder`, { orderedIds: [m2, m1] });
check("module reorder visible immediately", JSON.stringify(titles(await tree())) === JSON.stringify(["M2", "M1"]), titles(await tree()));
{
  const p = (await student.get(`/progress/${courseId}`)).json?.data;
  check("progress sequence follows the new order (next = T2)", p?.nextTopicId === t2, p?.nextTopicId);
}
await admin.patch(`/admin/courses/modules/${m2}`, { isPublished: false });
check("unpublished module hidden immediately", JSON.stringify(titles(await tree())) === JSON.stringify(["M1"]), titles(await tree()));
await admin.patch(`/admin/courses/modules/${m2}`, { isPublished: true });
check("re-published module back immediately", titles(await tree())?.length === 2, titles(await tree()));

// Assessment visibility: the module assessment is optional, so it can be unpublished
// while the module stays published — the tree must drop it at once, then show it again.
await admin.post(`/admin/assessments/${a1}/unpublish`);
{
  const M1 = (await tree())?.modules?.find((m: any) => m.id === m1);
  check("unpublished assessment disappears from the tree immediately (module stays published)", M1 && M1.assessmentId === null, M1?.assessmentId);
}
await admin.post(`/admin/assessments/${a1}/publish`);
{
  const t = await tree();
  const M1 = t?.modules?.find((m: any) => m.id === m1);
  check("assessment re-publish + module visible again", M1?.assessmentId === a1, M1?.assessmentId);
}
await admin.patch(`/admin/assessments/${a1}`, { estimatedDurationMinutes: 12 });
check("assessment estimate PATCH visible immediately", (await tree())?.modules?.find((m: any) => m.id === m1)?.assessmentDurationMinutes === 12);

// Branding.
await admin.put("/admin/branding", { logoUrl: "https://cdn.example.com/logo.png" });
check("branding PUT visible immediately", (await anon.get("/branding")).json?.data?.logoUrl === "https://cdn.example.com/logo.png", (await anon.get("/branding")).json?.data);

// Course unpublish → public 404 at once.
await admin.post(`/admin/courses/${courseId}/unpublish`);
check("unpublished course → 404 immediately", (await anon.get(`/courses/${SLUG}`)).status === 404);
check("admin still sees the draft course", (await admin.get(`/courses/${SLUG}`)).status === 200);

console.log(`\nCONTENT CACHE CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("Failures:\n - " + failures.join("\n - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
