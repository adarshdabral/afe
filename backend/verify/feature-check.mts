// Verifies the new features: Moocs@admin login, role-selection signup, and the
// renamed teacher in the registration directory.
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
await import("../src/index.ts");
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }

console.log("[Feature checks]");
// 1. Admin login with Moocs@admin / Admin@123
{
  const c = client();
  const r = await c.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
  check("login Moocs@admin / Admin@123 → platform_admin", r.status === 200 && r.json?.data?.role === "platform_admin", r.json?.data);
  check("admin name is 'Dr Sudhanshu Joshi'", r.json?.data?.name === "Dr Sudhanshu Joshi", r.json?.data?.name);
}
// 2. Teacher seed name + directory name
{
  const c = client();
  const t = await c.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
  check("teacher seed name is 'Dr Sudhanshu Joshi'", t.json?.data?.name === "Dr Sudhanshu Joshi", t.json?.data?.name);
  const dir = await c.get("/registrations/directory");
  const names = (dir.json?.data?.teachers ?? []).map((x: any) => x.name);
  check("directory teachers all named 'Dr Sudhanshu Joshi'", names.length > 0 && names.every((n: string) => n === "Dr Sudhanshu Joshi"), names);
}
// 3. Role-selection signup — teacher
{
  const c = client();
  const r = await c.post("/auth/signup", { role: "teacher", name: "New Teacher", username: "newteach", password: "Passw0rd!" });
  check("signup role=teacher → 201 active teacher", r.status === 201 && r.json?.data?.role === "teacher", r.json);
  const me = await c.get("/auth/me");
  check("signed-up teacher session resolves", me.json?.data?.role === "teacher", me.json?.data);
}
// 4. Role-selection signup — platform_admin, then login
{
  const c = client();
  const r = await c.post("/auth/signup", { role: "platform_admin", name: "New Admin", email: "newadmin@x.io", password: "Passw0rd!" });
  check("signup role=platform_admin → 201", r.status === 201 && r.json?.data?.role === "platform_admin", r.json?.data?.role);
  const login = await client().post("/auth/login", { login: "newadmin@x.io", password: "Passw0rd!" });
  check("new platform_admin can log in", login.status === 200 && login.json?.data?.role === "platform_admin", login.json?.data?.role);
}
// 5. Duplicate identifier rejected
{
  const c = client();
  const r = await c.post("/auth/signup", { role: "teacher", name: "Dup", email: "teacher@afe.edu", password: "Passw0rd!" });
  check("signup with existing email → 409", r.status === 409, r.status);
}

console.log(`\nFEATURE CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
