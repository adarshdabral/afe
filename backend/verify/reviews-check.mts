// Verifies Phase 2E — course reviews & ratings: add/edit/delete own, duplicate
// prevention, invalid-rating rejection, ownership, and automatic aggregate updates.
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4097;
const BASE = `http://127.0.0.1:${PORT}/api`;
const COURSE = "course-test-1";
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
    get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b),
    put: (p: string, b?: unknown) => req("PUT", p, b), del: (p: string) => req("DELETE", p),
  };
}
async function waitForHealth(t = 20000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  return false;
}
const agg = (j: any) => j?.json?.data?.aggregate;

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
await (await import("./_server.mts")).startServer();
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }

const A = client(); // student
const B = client(); // teacher
const anon = client();
await A.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
await B.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });

console.log("[Reviews — Phase 2E]");
// empty state (public)
{
  const r = await anon.get(`/courses/${COURSE}/reviews`);
  check("public GET reviews → 200, empty aggregate", r.status === 200 && agg(r)?.totalReviews === 0 && agg(r)?.averageRating === 0, r.json?.data);
}
// add (A, rating 4)
let rA = "";
{
  const r = await A.post(`/courses/${COURSE}/reviews`, { rating: 4, comment: "Great course" });
  check("A add review (rating 4) → 201", r.status === 201 && r.json?.data?.rating === 4, r.json);
  rA = r.json?.data?.id ?? "";
}
{
  const r = await anon.get(`/courses/${COURSE}/reviews`);
  check("aggregate auto-updated → avg 4, total 1", agg(r)?.averageRating === 4 && agg(r)?.totalReviews === 1, agg(r));
}
// duplicate
{
  const r = await A.post(`/courses/${COURSE}/reviews`, { rating: 3, comment: "again" });
  check("A duplicate review → 409", r.status === 409, r.status);
}
// invalid ratings
{
  const r0 = await B.post(`/courses/${COURSE}/reviews`, { rating: 0, comment: "bad" });
  const r6 = await B.post(`/courses/${COURSE}/reviews`, { rating: 6, comment: "bad" });
  const rx = await B.post(`/courses/${COURSE}/reviews`, { rating: 3.5, comment: "bad" });
  check("invalid rating 0 → 400", r0.status === 400, r0.status);
  check("invalid rating 6 → 400", r6.status === 400, r6.status);
  check("non-integer rating → 400", rx.status === 400, rx.status);
}
// second reviewer (B, rating 2)
let rB = "";
{
  const r = await B.post(`/courses/${COURSE}/reviews`, { rating: 2, comment: "ok" });
  check("B add review (rating 2) → 201", r.status === 201, r.json);
  rB = r.json?.data?.id ?? "";
  const list = await anon.get(`/courses/${COURSE}/reviews`);
  check("aggregate → avg 3, total 2", agg(list)?.averageRating === 3 && agg(list)?.totalReviews === 2, agg(list));
}
// list reflects 'mine' + recent (newest first) + author names
{
  const r = await A.get(`/courses/${COURSE}/reviews`);
  check("GET (as A) → mine is A's review", r.json?.data?.mine?.id === rA, r.json?.data?.mine?.id);
  check("recent reviews newest-first (B then A)", r.json?.data?.reviews?.[0]?.id === rB, r.json?.data?.reviews?.map((x: any) => x.id));
  check("reviews carry author names", typeof r.json?.data?.reviews?.[0]?.userName === "string" && r.json.data.reviews[0].userName.length > 0, r.json?.data?.reviews?.[0]?.userName);
}
// edit own (A → 5) recomputes
{
  const r = await A.put(`/reviews/${rA}`, { rating: 5, comment: "Even better now" });
  check("A edit own review → 200 rating 5", r.status === 200 && r.json?.data?.rating === 5, r.json?.data);
  const list = await anon.get(`/courses/${COURSE}/reviews`);
  check("aggregate after edit → avg 3.5, total 2", agg(list)?.averageRating === 3.5 && agg(list)?.totalReviews === 2, agg(list));
}
// ownership
{
  const r = await B.put(`/reviews/${rA}`, { rating: 1, comment: "hijack" });
  check("B edit A's review → 403", r.status === 403, r.status);
  const d = await A.del(`/reviews/${rB}`);
  check("A delete B's review → 403", d.status === 403, d.status);
}
// delete own + aggregate recompute
{
  const r = await B.del(`/reviews/${rB}`);
  check("B delete own review → 200", r.status === 200, r.json);
  const list = await anon.get(`/courses/${COURSE}/reviews`);
  check("aggregate after delete → avg 5, total 1", agg(list)?.averageRating === 5 && agg(list)?.totalReviews === 1, agg(list));
}
{
  const r = await A.del(`/reviews/${rA}`);
  check("A delete own review → 200", r.status === 200, r.json);
  const list = await anon.get(`/courses/${COURSE}/reviews`);
  check("aggregate back to empty → avg 0, total 0", agg(list)?.averageRating === 0 && agg(list)?.totalReviews === 0, agg(list));
}
// unauthenticated mutation
{
  const r = await anon.post(`/courses/${COURSE}/reviews`, { rating: 5, comment: "x" });
  check("unauthenticated add → 401", r.status === 401, r.status);
}

console.log(`\nREVIEWS CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
process.exit(fail ? 1 : 0);
