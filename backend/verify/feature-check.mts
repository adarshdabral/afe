// Verifies core auth rules: seeded Moocs@admin identity, teacher directory names,
// and that no self-service account creation exists for staff (the old role-select
// signup route is gone; teacher provisioning lives in /api/admin/teachers, which
// teacher-check.mts covers).
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4098;
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

console.log("[Feature checks]");

// 1. Seeded platform admin login + identity.
{
  const c = client();
  const r = await c.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
  check("login Moocs@admin / Admin@123 → platform_admin", r.status === 200 && r.json?.data?.role === "platform_admin", r.json?.data);
  check("admin name is 'Dr Sudhanshu Joshi'", r.json?.data?.name === "Dr Sudhanshu Joshi", r.json?.data?.name);
}

// 2. Teacher seed name + directory name.
{
  const c = client();
  const t = await c.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
  check("teacher seed name is 'Dr Sudhanshu Joshi'", t.json?.data?.name === "Dr Sudhanshu Joshi", t.json?.data?.name);
  const dir = await c.get("/registrations/directory");
  const names = (dir.json?.data?.teachers ?? []).map((x: any) => x.name);
  check("directory teachers all named 'Dr Sudhanshu Joshi'", names.length > 0 && names.every((n: string) => n === "Dr Sudhanshu Joshi"), names);
}

// 3. No staff self-registration — the old role-select signup route is gone.
{
  const c = client();
  const r = await c.post("/auth/signup", { role: "teacher", name: "X", username: "x", password: "Passw0rd!" });
  check("POST /auth/signup removed (self-signup blocked) → 404", r.status === 404, r.status);
}

// 4. Student self-registration (no teacher/class/roll) → approved by default and
//    auto-assigned to the default teacher.
{
  const c = client();
  const r = await c.post("/registrations", {
    fullName: "Self Student", schoolName: "Some School",
    email: "self.student@example.com", mobileNumber: "9990001111", password: "Passw0rd!",
  });
  check("student self-register → 201 approved (default: no teacher approval)", r.status === 201 && r.json?.data?.registrationStatus === "approved", r.json?.data);
}

console.log(`\nFEATURE CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
