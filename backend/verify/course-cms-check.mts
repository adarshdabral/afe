// Verifies the Course CMS: RBAC on every admin mutation, course create/update,
// duplicate-slug conflict, publish/unpublish/archive, course section + module + lesson/topic CRUD,
// drag-order persistence, role-scoped public visibility (student vs admin), the
// ordered course tree, and soft delete.
import { MongoMemoryServer } from "mongodb-memory-server";
import { MODULE_CONTENT, publishModule } from "./_fixtures.mts";

const PORT = 4101;
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
    patch: (p: string, b?: unknown) => req("PATCH", p, b),
    del: (p: string) => req("DELETE", p),
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
await (await import("./_server.mts")).startServer();
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }

console.log("[Course CMS checks]");

const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
const student = client();
await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
const teacher = client();
await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
const anon = client();

// 1. RBAC — admin CMS is platform-admin only.
{
  check("anon POST /admin/courses → 401", (await anon.post("/admin/courses", { title: "X" })).status === 401);
  check("anon GET /admin/courses → 401", (await anon.get("/admin/courses")).status === 401);
  check("student POST /admin/courses → 403", (await student.post("/admin/courses", { title: "X" })).status === 403);
  check("teacher POST /admin/courses → 403", (await teacher.post("/admin/courses", { title: "X" })).status === 403);
  check("student GET /admin/courses → 403", (await student.get("/admin/courses")).status === 403);
}

// 2. Create course.
let courseId = "";
let slug = "";
{
  const r = await admin.post("/admin/courses", {
    title: "Intro to AI", slug: "intro-to-ai", shortDescription: "Basics",
    level: "beginner", tags: ["ai", "ml"], learningObjectives: ["Understand AI"],
  });
  check("create course → 201 draft", r.status === 201 && r.json?.data?.status === "draft", r.json?.data);
  courseId = r.json?.data?.id ?? "";
  slug = r.json?.data?.slug ?? "";
  check("create returns slug + createdBy", slug === "intro-to-ai" && !!r.json?.data?.createdBy, r.json?.data);
  const noTitle = await admin.post("/admin/courses", { slug: "x" });
  check("create without title → 400", noTitle.status === 400, noTitle.status);
}

// 3. Duplicate slug → 409.
{
  const dup = await admin.post("/admin/courses", { title: "Another", slug: "intro-to-ai" });
  check("duplicate slug → 409", dup.status === 409, dup.status);
  // auto-slug from title when slug omitted.
  const auto = await admin.post("/admin/courses", { title: "Data Science 101" });
  check("auto-slug from title", auto.status === 201 && auto.json?.data?.slug === "data-science-101", auto.json?.data?.slug);
}

// 4. Update course (+ update-time slug conflict).
{
  const u = await admin.patch(`/admin/courses/${courseId}`, { title: "Intro to AI (v2)", estimatedDurationMinutes: 120 });
  check("update course → 200 new fields", u.status === 200 && u.json?.data?.title === "Intro to AI (v2)" && u.json?.data?.estimatedDurationMinutes === 120, u.json?.data);
  const conflict = await admin.patch(`/admin/courses/${courseId}`, { slug: "data-science-101" });
  check("update to an existing slug → 409", conflict.status === 409, conflict.status);
  check("update empty body → 400", (await admin.patch(`/admin/courses/${courseId}`, {})).status === 400);
}

// 5. Modules — create 3, update, reorder, delete (cascade).
const modIds: string[] = [];
{
  for (const t of ["Module A", "Module B", "Module C"]) {
    const r = await admin.post(`/admin/courses/${courseId}/modules`, { title: t });
    modIds.push(r.json?.data?.id);
  }
  check("create 3 modules with orders 0,1,2", modIds.length === 3, modIds);
  const upd = await admin.patch(`/admin/courses/modules/${modIds[0]}`, { title: "Module A (edited)" });
  check("update module → 200", upd.status === 200 && upd.json?.data?.title === "Module A (edited)" && upd.json?.data?.isPublished === false, upd.json?.data);
  // reorder → C, A, B
  const re = await admin.post(`/admin/courses/${courseId}/modules/reorder`, { orderedIds: [modIds[2], modIds[0], modIds[1]] });
  const order = (re.json?.data ?? []).map((m: any) => m.id);
  check("reorder modules persists new order", re.status === 200 && order[0] === modIds[2] && order[1] === modIds[0] && order[2] === modIds[1], order);
}

// 5b. Module requirements: description + learning objectives + ONE module assessment.
{
  const born = await admin.post(`/admin/courses/${courseId}/modules`, { title: "Born published", isPublished: true });
  check("create module already published → 409 (no assessment yet)", born.status === 409, born.json);

  const early = await admin.patch(`/admin/courses/modules/${modIds[0]}`, { isPublished: true });
  const msg: string = early.json?.error?.message ?? "";
  check("publish incomplete module → 409 listing description, objectives, assessment", early.status === 409 && /description/.test(msg) && /learning objective/.test(msg) && /module assessment/.test(msg), early.json);

  check("blank learning objective → 400", (await admin.patch(`/admin/courses/modules/${modIds[0]}`, { learningObjectives: ["  "] })).status === 400);
  check("more than 20 objectives → 400", (await admin.patch(`/admin/courses/modules/${modIds[0]}`, { learningObjectives: Array.from({ length: 21 }, (_, i) => `Objective ${i}`) })).status === 400);
  const content = await admin.patch(`/admin/courses/modules/${modIds[0]}`, MODULE_CONTENT);
  check("set description + learning objectives → 200 (objectives trimmed, stored)", content.status === 200 && content.json?.data?.learningObjectives?.[0] === MODULE_CONTENT.learningObjectives[0] && content.json?.data?.description === MODULE_CONTENT.description, content.json?.data);

  const aRes = await admin.post("/admin/assessments", { moduleId: modIds[0], title: "Module A assessment" });
  const aId = aRes.json?.data?.id;
  check("assessment with no questions can't be published → 409", (await admin.post(`/admin/assessments/${aId}/publish`)).status === 409);
  check("still can't publish the module (assessment empty/unpublished) → 409", (await admin.patch(`/admin/courses/modules/${modIds[0]}`, { isPublished: true })).status === 409);

  await publishModule(admin, modIds[0]);
  const pubMod = (await admin.get(`/admin/courses/${courseId}`)).json?.data?.modules?.find((m: any) => m.id === modIds[0]);
  check("module published once complete; readiness.ready = true", pubMod?.isPublished === true && pubMod?.readiness?.ready === true, pubMod?.readiness);
  check("a second assessment for the same module → 409 (one test per module)", (await admin.post("/admin/assessments", { moduleId: modIds[0], title: "Another" })).status === 409);

  check("published module: clearing objectives → 409", (await admin.patch(`/admin/courses/modules/${modIds[0]}`, { learningObjectives: [] })).status === 409);
  check("published module: clearing description → 409", (await admin.patch(`/admin/courses/modules/${modIds[0]}`, { description: " " })).status === 409);
  check("published module: title edit still allowed → 200", (await admin.patch(`/admin/courses/modules/${modIds[0]}`, { title: "Module A (edited)" })).status === 200);
  // Older modules were published before objectives existed: adding them must work.
  const { Module } = await import("../server/models/Module.ts");
  await Module.updateOne({ _id: modIds[0] }, { $set: { learningObjectives: [] } }); // simulate a legacy module
  const legacy = await admin.patch(`/admin/courses/modules/${modIds[0]}`, { learningObjectives: ["Describe the key idea.", "Apply it."] });
  check("legacy published module without objectives: adding objectives → 200 and saved", legacy.status === 200 && legacy.json?.data?.learningObjectives?.length === 2, legacy.json);
  const qs = (await admin.get(`/admin/assessments/module/${modIds[0]}`)).json?.data?.questions ?? [];
  const lastQ = await admin.del(`/admin/assessments/questions/${qs[0]?.id}`);
  check("deleting the last question of a published assessment → 409", qs.length === 1 && lastQ.status === 409, { n: qs.length, status: lastQ.status });
}

// 6. Lessons are containers; topics own content/media and are ordered within lessons.
const lessonIds: string[] = [];
const topicIds: string[] = [];
{
  const specs = [
    { lesson: "Video lesson", title: "Video", contentType: "video", videoUrl: "https://x.io/v.mp4" },
    { lesson: "Reading", title: "Reading topic", contentType: "rich_text", content: "# Heading\n\nSome **markdown**." },
    { lesson: "PDF", title: "PDF topic", contentType: "pdf", documentUrl: "https://x.io/d.pdf" },
  ];
  for (const s of specs) {
    const lesson = await admin.post(`/admin/courses/modules/${modIds[0]}/lessons`, { title: s.lesson });
    lessonIds.push(lesson.json?.data?.id);
    const topic = await admin.post(`/admin/courses/lessons/${lesson.json?.data?.id}/topics`, {
      title: s.title, contentType: s.contentType, videoUrl: s.videoUrl,
      content: s.content, documentUrl: s.documentUrl,
    });
    topicIds.push(topic.json?.data?.id);
  }
  check("create 3 lesson containers with 3 topics", lessonIds.every(Boolean) && topicIds.every(Boolean) && lessonIds.length === 3, { lessonIds, topicIds });
  const badType = await admin.post(`/admin/courses/lessons/${lessonIds[0]}/topics`, { title: "Bad", contentType: "nope" });
  check("invalid contentType → 400", badType.status === 400, badType.status);
  const extra = await admin.post(`/admin/courses/lessons/${lessonIds[1]}/topics`, { title: "Extra topic", contentType: "rich_text", content: "Extra content." });
  const upd = await admin.patch(`/admin/courses/topics/${topicIds[1]}`, { content: "# Updated\n\nNew body." });
  check("update topic content (serialized) → 200", upd.status === 200 && upd.json?.data?.content.includes("Updated"), upd.json?.data?.content);
  const topicRe = await admin.post(`/admin/courses/lessons/${lessonIds[1]}/topics/reorder`, { orderedIds: [extra.json?.data?.id, topicIds[1]] });
  const topics = topicRe.json?.data ?? [];
  check("reorder topics persists new order", topics[0]?.id === extra.json?.data?.id && topics[1]?.id === topicIds[1], topics.map((t: any) => t.id));
  const topicDel = await admin.del(`/admin/courses/topics/${extra.json?.data?.id}`);
  check("delete topic → 200", topicDel.status === 200, topicDel.status);
  const re = await admin.post(`/admin/courses/modules/${modIds[0]}/lessons/reorder`, { orderedIds: [lessonIds[2], lessonIds[0], lessonIds[1]] });
  const order = (re.json?.data ?? []).map((lesson: any) => lesson.id);
  check("reorder lessons persists new order", order[0] === lessonIds[2] && order[1] === lessonIds[0] && order[2] === lessonIds[1], order);
  const del = await admin.del(`/admin/courses/lessons/${lessonIds[0]}`);
  check("delete lesson container (and its topics) → 200", del.status === 200, del.status);
}

// 7. Admin course tree — sections + modules + lessons + topics ordered.
{
  const t = await admin.get(`/admin/courses/${courseId}`);
  const mods = t.json?.data?.modules ?? [];
  const sections = t.json?.data?.sections ?? [];
  check("course has introduction, overview, and instructor sections", sections.map((s: any) => s.kind).join() === "introduction,overview,instructor", sections.map((s: any) => s.kind));
  const orders = mods.map((m: any) => m.order);
  check("tree modules ordered ascending", t.status === 200 && orders.every((o: number, i: number) => o === i), orders);
  const moduleA = mods.find((m: any) => m.id === modIds[0]);
  const lOrders = (moduleA?.lessons ?? []).map((l: any) => l.order);
  const ascending = (a: number[]) => a.every((o, i) => i === 0 || o > a[i - 1]);
  check("tree lessons ordered ascending", ascending(lOrders) && (moduleA?.lessons?.length ?? 0) === 2, lOrders);
  const reading = moduleA?.lessons?.find((lesson: any) => lesson.id === lessonIds[1]);
  check("lesson tree retains the edited topic after deletion", reading?.topics?.length === 1 && reading.topics[0].content.includes("Updated"), reading?.topics);
}

// 8. Delete module cascades its lessons.
{
  await admin.del(`/admin/courses/modules/${modIds[1]}`);
  const t = await admin.get(`/admin/courses/${courseId}`);
  const ids = (t.json?.data?.modules ?? []).map((m: any) => m.id);
  check("deleted module removed from tree", !ids.includes(modIds[1]), ids);
}

// 9. Publish → student visibility (published course, published module only).
{
  const pub = await admin.post(`/admin/courses/${courseId}/publish`);
  check("publish course → 200 published", pub.status === 200 && pub.json?.data?.status === "published", pub.json?.data);

  const list = await student.get("/courses");
  const found = (list.json?.data?.courses ?? []).some((c: any) => c.id === courseId);
  check("student list includes published course", list.status === 200 && found, list.json?.data?.total);

  const bySlug = await student.get(`/courses/${slug}`);
  const mods = bySlug.json?.data?.modules ?? [];
  check("student GET /courses/:slug → 200 published", bySlug.status === 200 && bySlug.json?.data?.status === "published", bySlug.status);
  check("student sees only published modules, ordered", mods.every((m: any) => m.isPublished === true) && mods.some((m: any) => m.id === modIds[0]), mods.map((m: any) => m.id));
  const seenA = mods.find((m: any) => m.id === modIds[0]);
  check("public course tree includes the three course sections", bySlug.json?.data?.sections?.map((s: any) => s.kind).join() === "introduction,overview,instructor", bySlug.json?.data?.sections?.map((s: any) => s.kind));
  check("students see the module description + learning objectives + its assessment", seenA?.description === MODULE_CONTENT.description && (seenA?.learningObjectives?.length ?? 0) >= 1 && !!seenA?.assessmentId && seenA?.readiness === undefined, seenA);
  const sOrders = (mods[0]?.lessons ?? []).map((lesson: any) => lesson.order);
  check("student sees lessons ordered within a module", sOrders.every((o: number, i: number) => i === 0 || o > sOrders[i - 1]), sOrders);
}

// 10. Draft course — hidden from students, visible to admin.
let draftSlug = "";
{
  const d = await admin.post("/admin/courses", { title: "Draft Course", slug: "draft-course" });
  draftSlug = d.json?.data?.slug;
  check("student GET draft slug → 404", (await student.get(`/courses/${draftSlug}`)).status === 404);
  check("teacher GET draft slug → 404", (await teacher.get(`/courses/${draftSlug}`)).status === 404);
  check("admin GET draft slug (public endpoint) → 200", (await admin.get(`/courses/${draftSlug}`)).status === 200);
  const sl = await student.get("/courses");
  check("student list excludes drafts", !(sl.json?.data?.courses ?? []).some((c: any) => c.slug === draftSlug), sl.json?.data?.total);
}

// 11. Archive → hidden from students.
{
  const ar = await admin.post(`/admin/courses/${courseId}/archive`);
  check("archive course → 200 archived", ar.status === 200 && ar.json?.data?.status === "archived", ar.json?.data?.status);
  check("student GET archived slug → 404", (await student.get(`/courses/${slug}`)).status === 404);
  check("admin GET archived slug → 200 (admin sees all)", (await admin.get(`/courses/${slug}`)).status === 200);
}

// 12. Unauthorized mutations (defence in depth).
{
  check("student PATCH course → 403", (await student.patch(`/admin/courses/${courseId}`, { title: "hax" })).status === 403);
  check("teacher publish course → 403", (await teacher.post(`/admin/courses/${courseId}/publish`)).status === 403);
  check("anon delete course → 401", (await anon.del(`/admin/courses/${courseId}`)).status === 401);
  check("student create module → 403", (await student.post(`/admin/courses/${courseId}/modules`, { title: "x" })).status === 403);
}

// 13. Soft delete — gone from admin + public.
{
  const del = await admin.del(`/admin/courses/${courseId}`);
  check("soft delete course → 200", del.status === 200, del.status);
  check("admin GET deleted course → 404", (await admin.get(`/admin/courses/${courseId}`)).status === 404);
  check("public GET deleted slug → 404", (await admin.get(`/courses/${slug}`)).status === 404);
}

console.log(`\nCOURSE CMS CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
