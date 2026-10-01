// Verifies the teacher-management resource (/api/admin/teachers): platform-admin
// RBAC on every endpoint, create-with-generated-credentials, view/search/filter/
// paginate, edit, activate/deactivate (+ login gate), reset-password, and the
// 404/409 conflict paths.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4099;
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

console.log("[Teacher-management checks]");

const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });

// 1. RBAC — every endpoint is platform-admin only.
{
  const anon = client();
  check("anon GET /admin/teachers → 401", (await anon.get("/admin/teachers")).status === 401);
  check("anon POST /admin/teachers → 401", (await anon.post("/admin/teachers", { name: "N", email: "n@x.io" })).status === 401);

  const student = client();
  await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
  check("student GET /admin/teachers → 403", (await student.get("/admin/teachers")).status === 403);
  check("student POST /admin/teachers → 403", (await student.post("/admin/teachers", { name: "N", email: "n@x.io" })).status === 403);

  const teacher = client();
  await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
  check("teacher GET /admin/teachers → 403 (not an admin)", (await teacher.get("/admin/teachers")).status === 403);
}

// 2. Create teacher — generated credentials returned; teacher can log in with them.
let createdId = "";
let createdCreds: { loginId: string; temporaryPassword: string } | null = null;
{
  const r = await admin.post("/admin/teachers", {
    name: "Asha Rao", email: "asha@school.io", mobile: "9876500011", designation: "Senior Faculty",
    organization: "Doon University", specialization: "Machine Learning",
    bio: "Teaches applied ML.", profilePhoto: "https://example.com/asha.jpg",
  });
  check("create teacher → 201", r.status === 201, r.status);
  const t = r.json?.data?.teacher;
  createdCreds = r.json?.data?.credentials ?? null;
  createdId = t?.id ?? "";
  check("created teacher stores fields (designation/mobile)", t?.designation === "Senior Faculty" && t?.mobile === "9876500011", t);
  check("created teacher stores profile (org/specialization/bio/photo)",
    t?.organization === "Doon University" && t?.specialization === "Machine Learning" &&
    t?.bio === "Teaches applied ML." && t?.profilePhoto === "https://example.com/asha.jpg", t);
  check("invalid profilePhoto URL → 400", (await admin.post("/admin/teachers", { name: "Bad Photo", email: "bp@school.io", profilePhoto: "not-a-url" })).status === 400);
  check("created teacher is active", t?.active === true, t);
  check("temporary password returned to admin", !!createdCreds?.temporaryPassword && createdCreds.loginId === "asha@school.io", createdCreds);
  // The temp password must actually work for login (hashed + stored correctly).
  const login = await client().post("/auth/login", { login: "asha@school.io", password: createdCreds!.temporaryPassword });
  check("teacher logs in with generated temp password", login.status === 200 && login.json?.data?.role === "teacher", login.status);
}

// 3. Duplicate email → 409; invalid email → 400.
{
  const dup = await admin.post("/admin/teachers", { name: "Dup", email: "asha@school.io" });
  check("duplicate email → 409", dup.status === 409, dup.status);
  const bad = await admin.post("/admin/teachers", { name: "Bad", email: "not-an-email" });
  check("invalid email → 400", bad.status === 400, bad.status);
}

// 4. Get by id (+ 404 for unknown).
{
  const g = await admin.get(`/admin/teachers/${createdId}`);
  check("get teacher by id → 200", g.status === 200 && g.json?.data?.id === createdId, g.status);
  check("get unknown id → 404", (await admin.get("/admin/teachers/nope-123")).status === 404);
}

// 5. Edit teacher.
{
  const u = await admin.patch(`/admin/teachers/${createdId}`, { designation: "Head of Department", name: "Asha M. Rao" });
  check("edit teacher → 200 with new fields", u.status === 200 && u.json?.data?.designation === "Head of Department" && u.json?.data?.name === "Asha M. Rao", u.json?.data);
  check("edit empty body → 400", (await admin.patch(`/admin/teachers/${createdId}`, {})).status === 400);
}

// 6. Seed a cohort to exercise search / filter / pagination.
const emails: string[] = [];
for (let i = 0; i < 12; i++) {
  const email = `bulk${i}@school.io`;
  emails.push(email);
  await admin.post("/admin/teachers", { name: `Bulk Teacher ${i}`, email, designation: i % 2 ? "Lecturer" : "Professor" });
}

// 7. Pagination.
{
  const p1 = await admin.get("/admin/teachers?page=1&pageSize=5");
  const d = p1.json?.data;
  check("pagination page=1 pageSize=5 → 5 rows", d?.teachers?.length === 5, d?.teachers?.length);
  check("pagination reports total >= 13 and totalPages", d?.total >= 13 && d?.totalPages === Math.ceil(d.total / 5), { total: d?.total, totalPages: d?.totalPages });
  const p3 = await admin.get("/admin/teachers?page=3&pageSize=5");
  check("pagination page=3 returns remaining rows", (p3.json?.data?.teachers?.length ?? 0) > 0 && p3.json?.data?.page === 3, p3.json?.data?.page);
}

// 8. Search (by name / designation).
{
  const s = await admin.get("/admin/teachers?search=Asha");
  const names = (s.json?.data?.teachers ?? []).map((t: any) => t.name);
  check("search 'Asha' → matches edited teacher", names.some((n: string) => n.includes("Asha")) && s.json?.data?.total === 1, names);
  const prof = await admin.get("/admin/teachers?search=Professor&pageSize=100");
  check("search 'Professor' matches designation", (prof.json?.data?.teachers ?? []).every((t: any) => t.designation === "Professor") && prof.json?.data?.total >= 6, prof.json?.data?.total);
  const org = await admin.get("/admin/teachers?search=Doon University&pageSize=100");
  check("search matches organization field", (org.json?.data?.teachers ?? []).some((t: any) => t.id === createdId) && org.json?.data?.total === 1, org.json?.data?.total);
}

// 9. Deactivate → login blocked (403); filter=inactive lists it; reactivate → login works.
{
  const d = await admin.post(`/admin/teachers/${createdId}/deactivate`);
  check("deactivate teacher → 200 active=false", d.status === 200 && d.json?.data?.active === false, d.json?.data);
  const blocked = await client().post("/auth/login", { login: "asha@school.io", password: createdCreds!.temporaryPassword });
  check("deactivated teacher login → 403", blocked.status === 403, blocked.status);

  const inactive = await admin.get("/admin/teachers?status=inactive&pageSize=100");
  check("status=inactive lists the deactivated teacher", (inactive.json?.data?.teachers ?? []).some((t: any) => t.id === createdId), inactive.json?.data?.total);
  const activeOnly = await admin.get("/admin/teachers?status=active&pageSize=100");
  check("status=active excludes the deactivated teacher", !(activeOnly.json?.data?.teachers ?? []).some((t: any) => t.id === createdId), activeOnly.json?.data?.total);

  const a = await admin.post(`/admin/teachers/${createdId}/activate`);
  check("reactivate teacher → 200 active=true", a.status === 200 && a.json?.data?.active === true, a.json?.data);
  const ok = await client().post("/auth/login", { login: "asha@school.io", password: createdCreds!.temporaryPassword });
  check("reactivated teacher login → 200", ok.status === 200, ok.status);
}

// 10. Reset password — old password fails, new one works.
{
  const r = await admin.post(`/admin/teachers/${createdId}/reset-password`);
  const newPass = r.json?.data?.credentials?.temporaryPassword;
  check("reset-password → 200 returns new temp password", r.status === 200 && !!newPass, r.status);
  const oldFail = await client().post("/auth/login", { login: "asha@school.io", password: createdCreds!.temporaryPassword });
  check("old password no longer works → 401", oldFail.status === 401, oldFail.status);
  const newOk = await client().post("/auth/login", { login: "asha@school.io", password: newPass });
  check("new temp password works → 200", newOk.status === 200, newOk.status);
  check("reset unknown id → 404", (await admin.post("/admin/teachers/nope-123/reset-password")).status === 404);
}

console.log(`\nTEACHER CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
