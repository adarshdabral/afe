// END-TO-END platform-admin journey: teacher management (CRUD + activate/
// deactivate + reset password) → course management (create/update/publish/
// archive) → module management (create/edit/reorder) → lesson/topic management
// (create/edit/reorder) → assessment management (create/publish/edit) →
// certificate management (list/revoke) → analytics endpoints load.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4111;
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
async function up(t = 20000) { const s = Date.now(); while (Date.now()-s<t){try{if((await fetch(`${BASE}/health`)).ok)return true}catch{}await new Promise(r=>setTimeout(r,250))} return false; }

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
await (await import("./_server.mts")).startServer();
if (!(await up())) { console.error("not healthy"); process.exit(1); }

console.log("[E2E admin journey]");
const admin = client();
{
  const r = await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
  check("[1] admin login → dashboard access (platform_admin)", r.status === 200 && r.json?.data?.role === "platform_admin", r.json?.data);
}

// ---- 2. Teacher management ----
console.log("[2] Teacher management");
let teacherId = "", tempPw = "";
{
  const c = await admin.post("/admin/teachers", { name: "Prof QA", email: "profqa@school.io", designation: "Lecturer" });
  teacherId = c.json?.data?.teacher?.id; tempPw = c.json?.data?.credentials?.temporaryPassword;
  check("create teacher → 201 + credentials", c.status === 201 && !!teacherId && !!tempPw, c.json?.data?.teacher);
  const e = await admin.patch(`/admin/teachers/${teacherId}`, { designation: "Senior Lecturer", organization: "Doon Univ" });
  check("edit teacher → 200", e.status === 200 && e.json?.data?.designation === "Senior Lecturer", e.json?.data);
  const d = await admin.post(`/admin/teachers/${teacherId}/deactivate`);
  check("deactivate teacher → active:false", d.json?.data?.active === false, d.json?.data);
  const blocked = await client().post("/auth/login", { login: "profqa@school.io", password: tempPw });
  check("deactivated teacher cannot log in → 403", blocked.status === 403, blocked.status);
  const a = await admin.post(`/admin/teachers/${teacherId}/activate`);
  check("activate teacher → active:true", a.json?.data?.active === true, a.json?.data);
  const rp = await admin.post(`/admin/teachers/${teacherId}/reset-password`);
  const newPw = rp.json?.data?.credentials?.temporaryPassword;
  check("reset password → new temp password issued", rp.status === 200 && !!newPw && newPw !== tempPw, !!newPw);
  const login = await client().post("/auth/login", { login: "profqa@school.io", password: newPw });
  check("teacher logs in with reset password → 200", login.status === 200 && login.json?.data?.role === "teacher", login.status);
}

// ---- 3. Course management ----
console.log("[3] Course management");
let courseId = "";
{
  const c = await admin.post("/admin/courses", { title: "Admin QA Course", slug: "admin-qa" });
  courseId = c.json?.data?.id;
  check("create course → 201 draft", c.status === 201 && c.json?.data?.status === "draft", c.json?.data?.status);
  const u = await admin.patch(`/admin/courses/${courseId}`, { title: "Admin QA Course v2", level: "advanced" });
  check("update course → 200", u.status === 200 && u.json?.data?.title === "Admin QA Course v2", u.json?.data);
  const pub = await admin.post(`/admin/courses/${courseId}/publish`);
  check("publish course → published", pub.json?.data?.status === "published", pub.json?.data);
  const arc = await admin.post(`/admin/courses/${courseId}/archive`);
  check("archive course → archived", arc.json?.data?.status === "archived", arc.json?.data);
  await admin.post(`/admin/courses/${courseId}/publish`); // back to published for later steps
}

// ---- 4. Module management ----
console.log("[4] Module management");
const mods: string[] = [];
{
  for (const t of ["A", "B", "C"]) mods.push((await admin.post(`/admin/courses/${courseId}/modules`, { title: `Mod ${t}` })).json.data.id);
  check("create 3 modules", mods.every(Boolean), mods);
  const e = await admin.patch(`/admin/courses/modules/${mods[0]}`, {
    title: "Mod A (edited)",
    description: "What Mod A covers.",
    learningObjectives: ["Explain the core idea of Mod A.", "Apply it to an example."],
  });
  check("edit module (title, description, learning objectives) → 200", e.json?.data?.title === "Mod A (edited)" && e.json?.data?.learningObjectives?.length === 2, e.json?.data);
  const early = await admin.patch(`/admin/courses/modules/${mods[0]}`, { isPublished: true });
  check("publish module with description + objectives but no assessment → 200 (assessment optional)", early.status === 200 && early.json?.data?.isPublished === true, early.json);
  await admin.patch(`/admin/courses/modules/${mods[0]}`, { isPublished: false });
  const re = await admin.post(`/admin/courses/${courseId}/modules/reorder`, { orderedIds: [mods[2], mods[0], mods[1]] });
  const order = (re.json?.data ?? []).map((m: any) => m.id);
  check("reorder modules persists", order[0] === mods[2] && order[1] === mods[0], order);
}

// ---- 5. Lesson and topic management ----
console.log("[5] Lesson and topic management");
const lessons: string[] = [];
const topics: string[] = [];
{
  for (const t of ["L1", "L2", "L3"]) {
    const lesson = await admin.post(`/admin/courses/modules/${mods[0]}/lessons`, { title: `${t} lesson` });
    lessons.push(lesson.json.data.id);
    topics.push((await admin.post(`/admin/courses/lessons/${lesson.json.data.id}/topics`, { title: t, contentType: "rich_text", content: "x" })).json.data.id);
  }
  check("create 3 lesson containers and 3 topics", lessons.every(Boolean) && topics.every(Boolean), { lessons, topics });
  const e = await admin.patch(`/admin/courses/topics/${topics[0]}`, { title: "L1 (edited)", content: "# Updated" });
  check("edit topic → 200", e.json?.data?.title === "L1 (edited)", e.json?.data);
  const re = await admin.post(`/admin/courses/modules/${mods[0]}/lessons/reorder`, { orderedIds: [lessons[2], lessons[0], lessons[1]] });
  const order = (re.json?.data ?? []).map((lesson: any) => lesson.id);
  check("reorder lessons persists", order[0] === lessons[2], order);
}

// ---- 6. Assessment management ----
console.log("[6] Assessment management");
let aId = "";
{
  const c = await admin.post("/admin/assessments", { moduleId: mods[0], title: "Admin Quiz" });
  aId = c.json?.data?.id;
  check("create assessment → 201", c.status === 201 && !!aId, c.json?.data);
  const q = await admin.post(`/admin/assessments/${aId}/questions`, { type: "mcq", question: "?", options: ["A","B"], correctAnswer: "A", marks: 1 });
  check("add question → 201", q.status === 201, q.status);
  const e = await admin.patch(`/admin/assessments/${aId}`, { passingScore: 70 });
  check("edit assessment (passingScore) → 200", e.json?.data?.passingScore === 70, e.json?.data);
  const p = await admin.post(`/admin/assessments/${aId}/publish`);
  check("publish assessment → isPublished true", p.json?.data?.isPublished === true, p.json?.data);
  const pm = await admin.patch(`/admin/courses/modules/${mods[0]}`, { isPublished: true });
  check("publish module (description + objectives + assessment) → 200", pm.status === 200 && pm.json?.data?.isPublished === true, pm.json);
  const tree = (await admin.get(`/admin/courses/${courseId}`)).json?.data;
  const modA = tree?.modules?.find((m: any) => m.id === mods[0]);
  const modB = tree?.modules?.find((m: any) => m.id === mods[1]);
  check("admin tree reports readiness (A ready, B missing description + objectives only)", modA?.readiness?.ready === true && modB?.readiness?.ready === false && JSON.stringify(modB?.readiness?.missing) === JSON.stringify(["a module description", "at least one learning objective"]), { a: modA?.readiness, b: modB?.readiness });
}

// ---- 7. Certificate management ----
console.log("[7] Certificate management");
{
  // Manufacture a certificate: a student completes this course.
  const student = client();
  await student.post("/registrations", { fullName: "Cert Student", email: "certstu@qa.io", password: "Passw0rd!", mobileNumber: "9007007007", schoolName: "QA" });
  // Complete the (single published) module's topics in order, pass the quiz.
  const tree = (await student.get("/courses/admin-qa")).json.data;
  const seq = tree.modules.flatMap((m: any) => m.lessons.flatMap((l: any) => l.topics.map((topic: any) => topic.id)));
  for (const topicId of seq) await student.post(`/progress/${courseId}/topics/${topicId}/complete`);
  const qid = (await admin.get(`/admin/assessments/${aId}`)).json.data.questions[0].id;
  await student.post(`/assessments/${aId}/attempt`, { answers: [{ questionId: qid, answer: "A" }] });
  const list = await admin.get("/certificates");
  const cert = (list.json?.data ?? [])[0];
  check("admin lists certificates (≥1 issued)", list.status === 200 && (list.json?.data ?? []).length >= 1, list.json?.data?.length);
  if (cert) {
    const rev = await admin.post(`/certificates/${cert.certificateId}/revoke`);
    check("revoke certificate → status revoked", rev.json?.data?.status === "revoked", rev.json?.data);
    const v = await client().get(`/certificates/verify/${cert.certificateId}`);
    check("revoked certificate verifies invalid", v.json?.data?.valid === false, v.json?.data);
  } else {
    check("certificate manufactured for revoke test", false, list.json?.data);
    check("revoked certificate verifies invalid", false);
  }
}

// ---- 8. Analytics ----
console.log("[8] Analytics");
{
  const p = await admin.get("/analytics/platform");
  check("platform analytics loads", p.status === 200 && typeof p.json?.data?.totalStudents === "number", p.json?.data);
}

console.log(`\nE2E ADMIN JOURNEY: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
