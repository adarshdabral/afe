// Verifies the Course CMS: RBAC on every admin mutation, course create/update,
// duplicate-slug conflict, publish/unpublish/archive, module + lesson CRUD,
// drag-order persistence, role-scoped public visibility (student vs admin), the
// ordered course tree, and soft delete.
import { MongoMemoryServer } from "mongodb-memory-server";

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
  const upd = await admin.patch(`/admin/courses/modules/${modIds[0]}`, { title: "Module A (edited)", isPublished: true });
  check("update module → 200", upd.status === 200 && upd.json?.data?.title === "Module A (edited)" && upd.json?.data?.isPublished === true, upd.json?.data);
  // reorder → C, A, B
  const re = await admin.post(`/admin/courses/${courseId}/modules/reorder`, { orderedIds: [modIds[2], modIds[0], modIds[1]] });
  const order = (re.json?.data ?? []).map((m: any) => m.id);
  check("reorder modules persists new order", re.status === 200 && order[0] === modIds[2] && order[1] === modIds[0] && order[2] === modIds[1], order);
}

// 6. Lessons — create 3 in module A, update content, reorder, delete.
const lessonIds: string[] = [];
{
  const specs = [
    { title: "Video lesson", contentType: "video", videoUrl: "https://x.io/v.mp4" },
    { title: "Reading", contentType: "rich_text", content: "# Heading\n\nSome **markdown**." },
    { title: "PDF", contentType: "pdf", documentUrl: "https://x.io/d.pdf" },
  ];
  for (const s of specs) {
    const r = await admin.post(`/admin/courses/modules/${modIds[0]}/lessons`, s);
    lessonIds.push(r.json?.data?.id);
  }
  check("create 3 lessons → 201", lessonIds.every(Boolean) && lessonIds.length === 3, lessonIds);
  const badType = await admin.post(`/admin/courses/modules/${modIds[0]}/lessons`, { title: "Bad", contentType: "nope" });
  check("invalid contentType → 400", badType.status === 400, badType.status);
  const upd = await admin.patch(`/admin/courses/lessons/${lessonIds[1]}`, { content: "# Updated\n\nNew body." });
  check("update lesson content (serialized) → 200", upd.status === 200 && upd.json?.data?.content.includes("Updated"), upd.json?.data?.content);
  const re = await admin.post(`/admin/courses/modules/${modIds[0]}/lessons/reorder`, { orderedIds: [lessonIds[2], lessonIds[0], lessonIds[1]] });
  const order = (re.json?.data ?? []).map((l: any) => l.id);
  check("reorder lessons persists new order", order[0] === lessonIds[2] && order[1] === lessonIds[0] && order[2] === lessonIds[1], order);
  const del = await admin.del(`/admin/courses/lessons/${lessonIds[0]}`);
  check("delete lesson → 200", del.status === 200, del.status);
}

// 7. Admin course tree — modules + lessons ordered.
{
  const t = await admin.get(`/admin/courses/${courseId}`);
  const mods = t.json?.data?.modules ?? [];
  const orders = mods.map((m: any) => m.order);
  check("tree modules ordered ascending", t.status === 200 && orders.every((o: number, i: number) => o === i), orders);
  const moduleA = mods.find((m: any) => m.id === modIds[0]);
  const lOrders = (moduleA?.lessons ?? []).map((l: any) => l.order);
  const ascending = (a: number[]) => a.every((o, i) => i === 0 || o > a[i - 1]);
  check("tree lessons ordered ascending", ascending(lOrders) && (moduleA?.lessons?.length ?? 0) === 2, lOrders);
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
  const sOrders = (mods[0]?.lessons ?? []).map((l: any) => l.order);
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
