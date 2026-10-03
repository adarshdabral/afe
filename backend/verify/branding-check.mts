// Verifies platform branding (the logo that replaces the default Sparkles mark):
// - GET /api/branding is public and starts empty
// - only platform admins may set it (401 anonymous, 403 student/teacher)
// - accepted URLs: uploaded "/api/uploads/<file>" paths and https (R2); anything
//   else (javascript:, data:, http://, path traversal) → 400
// - "" removes the logo; an uploaded image's URL round-trips end to end
// - SVG uploads are served with a sandboxing CSP
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4171;
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
    put: (p: string, b?: unknown) => req("PUT", p, b),
    post: (p: string, b?: unknown) => req("POST", p, b),
    cookie: () => cookie,
  };
}

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
await (await import("./_server.mts")).startServer(PORT);
if (!(await fetch(`${BASE}/health`)).ok) { console.error("not healthy"); process.exit(1); }

const anon = client();
const student = client();
const teacher = client();
const admin = client();
await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });

console.log("[Branding — public read]");
{
  const r = await anon.get("/branding");
  check("GET /branding is public → 200, no logo yet", r.status === 200 && r.json?.data?.logoUrl === "", r);
}

console.log("[Branding — access control]");
{
  const body = { logoUrl: "/api/uploads/logo.png" };
  check("anonymous PUT → 401", (await anon.put("/admin/branding", body)).status === 401);
  check("student PUT → 403", (await student.put("/admin/branding", body)).status === 403);
  check("teacher PUT → 403", (await teacher.put("/admin/branding", body)).status === 403);
  check("logo unchanged after rejected writes", (await anon.get("/branding")).json?.data?.logoUrl === "");
}

console.log("[Branding — validation]");
for (const bad of ["javascript:alert(1)", "data:image/svg+xml;base64,AAAA", "http://evil.example/x.png", "/api/uploads/../../etc/passwd", "/etc/passwd", "x".repeat(600)]) {
  const r = await admin.put("/admin/branding", { logoUrl: bad });
  check(`rejects ${JSON.stringify(bad.slice(0, 40))} → 400`, r.status === 400, r);
}
check("missing logoUrl → 400", (await admin.put("/admin/branding", {})).status === 400);

console.log("[Branding — set / replace / remove]");
{
  const r2 = "https://pub-abc.r2.dev/document/2026/10/logo.png";
  const set = await admin.put("/admin/branding", { logoUrl: r2 });
  check("admin sets an https (R2) logo → 200", set.status === 200 && set.json?.data?.logoUrl === r2 && !!set.json?.data?.updatedAt, set.json);
  check("public GET returns it", (await anon.get("/branding")).json?.data?.logoUrl === r2);

  // Real upload through the local-storage path, then use its URL.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "logo.png");
  const up = await fetch(`${BASE}/admin/uploads`, { method: "POST", headers: { cookie: admin.cookie() }, body: form });
  const upJson: any = await up.json().catch(() => null);
  const url = upJson?.data?.url as string | undefined;
  check("PNG logo uploads → /api/uploads/<file>", up.status === 201 || up.status === 200 ? !!url?.startsWith("/api/uploads/") : false, { status: up.status, upJson });
  if (url) {
    const rep = await admin.put("/admin/branding", { logoUrl: url });
    check("admin replaces logo with the uploaded file", rep.status === 200 && rep.json?.data?.logoUrl === url, rep.json);
    const img = await fetch(`http://127.0.0.1:${PORT}${url}`);
    check("uploaded logo is served as image/png", img.status === 200 && img.headers.get("content-type") === "image/png", img.status);
  }

  const del = await admin.put("/admin/branding", { logoUrl: "" });
  check("\"\" removes the logo", del.status === 200 && del.json?.data?.logoUrl === "", del.json);
  check("public GET shows no logo again", (await anon.get("/branding")).json?.data?.logoUrl === "");
}

console.log("[SVG uploads are sandboxed]");
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>`;
  const form = new FormData();
  form.append("file", new Blob([svg], { type: "image/svg+xml" }), "logo.svg");
  const up = await fetch(`${BASE}/admin/uploads`, { method: "POST", headers: { cookie: admin.cookie() }, body: form });
  const url = ((await up.json().catch(() => null)) as any)?.data?.url as string | undefined;
  const res = url ? await fetch(`http://127.0.0.1:${PORT}${url}`) : null;
  const csp = res?.headers.get("content-security-policy") ?? "";
  check("SVG served with a sandboxing CSP (no script execution)", !!res && res.status === 200 && csp.includes("sandbox") && csp.includes("default-src 'none'"), { status: res?.status, csp });
}

console.log(`\nBRANDING CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
