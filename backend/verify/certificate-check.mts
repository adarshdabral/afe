// Verifies the Certificate System: automatic issuance on certificate-eligibility,
// duplicate prevention (idempotent), AFE-YYYY-XXXXXXXX id format, public
// verification, PDF download + access control, admin listing, and revocation.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4105;
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
    const headers: Record<string, string> = {};
    if (cookie) headers["cookie"] = cookie;
    const res = await fetch(`${BASE}${path}`, { headers });
    const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
    return { status: res.status, contentType: res.headers.get("content-type") ?? "", bytes: buf.byteLength };
  }
  return {
    get: (p: string) => req("GET", p),
    post: (p: string, b?: unknown) => req("POST", p, b),
    patch: (p: string, b?: unknown) => req("PATCH", p, b),
    raw,
    login: (l: string, pw: string) => req("POST", "/auth/login", { login: l, password: pw }),
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
await import("../src/index.ts");
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }

console.log("[Certificate System checks]");
const admin = client();
await admin.login("Moocs@admin", "Admin@123");
const student = client();
await student.login("student@afe.edu", "Student@123");
const teacher = client();
await teacher.login("teacher@afe.edu", "Teacher@123");
const anon = client();

// Seed a small completable course: 1 published module, 1 lesson, 1 published quiz.
const courseId = (await admin.post("/admin/courses", { title: "Certified Course", slug: "certified-course" })).json.data.id;
const m1 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M1" })).json.data.id;
await admin.patch(`/admin/courses/modules/${m1}`, { isPublished: true });
const L1 = (await admin.post(`/admin/courses/modules/${m1}/lessons`, { title: "L1", contentType: "rich_text", content: "x" })).json.data.id;
await admin.post(`/admin/courses/${courseId}/publish`);
const assessmentId = (await admin.post("/admin/assessments", { moduleId: m1, title: "Final" })).json.data.id;
const q = (await admin.post(`/admin/assessments/${assessmentId}/questions`, { type: "mcq", question: "?", options: ["A", "B"], correctAnswer: "A", marks: 1 })).json.data.id;
await admin.post(`/admin/assessments/${assessmentId}/publish`);

// 1. No certificate before completion.
{
  const mine = await student.get("/certificates/mine");
  check("student has no certificates initially", mine.status === 200 && Array.isArray(mine.json?.data) && mine.json.data.length === 0, mine.json?.data);
  check("claim before eligible → 403", (await student.post("/certificates/issue", { courseId })).status === 403);
}

// 2. Complete the course → certificate auto-issued.
let cert: any = null;
{
  await student.post(`/progress/${courseId}/lessons/${L1}/complete`);
  const attempt = await student.post(`/assessments/${assessmentId}/attempt`, { answers: [{ questionId: q, answer: "A" }] });
  check("assessment passed (triggers eligibility)", attempt.json?.data?.attempt?.passed === true, attempt.json?.data?.attempt);
  const mine = await student.get("/certificates/mine");
  cert = (mine.json?.data ?? [])[0];
  check("certificate auto-issued on eligibility", mine.json.data.length === 1 && !!cert, mine.json?.data);
  check("certificate id matches AFE-YYYY-XXXXXXXX", /^AFE-\d{4}-[0-9A-F]{8}$/.test(cert?.certificateId ?? ""), cert?.certificateId);
  check("certificate snapshots student + course + status", cert?.studentName === "Aarav Singh" && cert?.courseTitle === "Certified Course" && cert?.status === "active", cert);
  check("certificate has verificationCode + qrCode", !!cert?.verificationCode && (cert?.qrCode ?? "").includes(`/certificate/verify/${cert.certificateId}`), cert);
}

// 3. Duplicate prevention — idempotent.
{
  const again = await student.post("/certificates/issue", { courseId });
  check("re-claim returns same certificate → 201", again.status === 201 && again.json?.data?.certificateId === cert.certificateId, again.json?.data?.certificateId);
  const mine = await student.get("/certificates/mine");
  check("still exactly one certificate", mine.json.data.length === 1, mine.json.data.length);
}

// 4. Public verification (teachers + anyone).
{
  const v = await anon.get(`/certificates/verify/${cert.certificateId}`);
  check("public verify (anon) → valid:true", v.status === 200 && v.json?.data?.valid === true, v.json?.data);
  check("verify exposes student/course/issueDate/status", v.json?.data?.certificate?.courseTitle === "Certified Course" && !!v.json?.data?.certificate?.issueDate && v.json?.data?.certificate?.status === "active", v.json?.data?.certificate);
  const t = await teacher.get(`/certificates/verify/${cert.certificateId}`);
  check("teacher can verify a certificate → valid:true", t.json?.data?.valid === true, t.json?.data);
  const bad = await anon.get("/certificates/verify/AFE-2026-DEADBEEF");
  check("verify unknown id → valid:false", bad.status === 200 && bad.json?.data?.valid === false, bad.json?.data);
}

// 5. PDF download + access control.
{
  const owner = await student.raw(`/certificates/${cert.certificateId}/download`);
  check("owner downloads PDF → 200 application/pdf", owner.status === 200 && owner.contentType.includes("application/pdf") && owner.bytes > 500, owner);
  check("anon download → 401", (await anon.raw(`/certificates/${cert.certificateId}/download`)).status === 401);
  check("teacher (non-owner) download → 403", (await teacher.raw(`/certificates/${cert.certificateId}/download`)).status === 403);
  const adminDl = await admin.raw(`/certificates/${cert.certificateId}/download`);
  check("admin downloads any PDF → 200", adminDl.status === 200 && adminDl.contentType.includes("application/pdf"), adminDl);
}

// 6. Access control on mine / list / revoke.
{
  check("anon GET /certificates/mine → 401", (await anon.get("/certificates/mine")).status === 401);
  check("teacher GET /certificates/mine → 403 (student-only)", (await teacher.get("/certificates/mine")).status === 403);
  check("student GET /certificates (list all) → 403", (await student.get("/certificates")).status === 403);
  const all = await admin.get("/certificates");
  check("admin lists all certificates", all.status === 200 && (all.json?.data ?? []).some((c: any) => c.certificateId === cert.certificateId), all.json?.data?.length);
  check("anon revoke → 401", (await anon.post(`/certificates/${cert.certificateId}/revoke`)).status === 401);
  check("student revoke → 403", (await student.post(`/certificates/${cert.certificateId}/revoke`)).status === 403);
  check("teacher revoke → 403", (await teacher.post(`/certificates/${cert.certificateId}/revoke`)).status === 403);
}

// 7. Revocation.
{
  const rev = await admin.post(`/certificates/${cert.certificateId}/revoke`);
  check("admin revoke → 200 status revoked", rev.status === 200 && rev.json?.data?.status === "revoked", rev.json?.data);
  const v = await anon.get(`/certificates/verify/${cert.certificateId}`);
  check("revoked certificate verifies as invalid", v.json?.data?.valid === false && v.json?.data?.certificate?.status === "revoked", v.json?.data);
  const mine = await student.get("/certificates/mine");
  check("student still sees the (revoked) certificate", (mine.json?.data ?? [])[0]?.status === "revoked", mine.json?.data);
  check("revoke unknown id → 404", (await admin.post("/certificates/AFE-2026-NOPE0000/revoke")).status === 404);
}

console.log(`\nCERTIFICATE CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
