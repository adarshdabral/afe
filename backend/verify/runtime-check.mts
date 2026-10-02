// Runtime verification harness (not part of the app). Boots an ephemeral
// in-memory MongoDB, starts the real Next.js app (pages + API Route Handlers), and
// exercises every route group end-to-end with a cookie jar. Run:
//   npx tsx verify/runtime-check.mts
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4099;
const BASE = `http://127.0.0.1:${PORT}/api`;

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

/** A cookie-jar HTTP client (one per logical session/user). */
function makeClient() {
  let cookie = "";
  async function req(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers["cookie"] = cookie;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      const kv = sc.split(";")[0];
      if (kv.startsWith("afe_session=")) cookie = kv;
    }
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* no body */
    }
    return { status: res.status, json };
  }
  return {
    get: (p: string) => req("GET", p),
    post: (p: string, b?: unknown) => req("POST", p, b),
    hasCookie: () => !!cookie,
  };
}

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  console.log("Starting in-memory MongoDB…");
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("ai-spark");
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234"; // >= 32
  process.env.PORT = String(PORT);
  process.env.NODE_ENV = "test";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  process.env.REQUIRE_TEACHER_APPROVAL = "true"; // this harness tests the approval workflow
  console.log("Mongo URI:", process.env.MONGODB_URI);

  // Importing the app triggers start(): connectDb → seeds → listen.
  await (await import("./_server.mts")).startServer();
  const up = await waitForHealth();
  if (!up) {
    console.error("Server did not become healthy in time.");
    process.exit(1);
  }
  console.log("Server healthy.\n");

  // ---- Task 5: MongoDB integration (implicit via health + seeded reads) ----
  console.log("[Task 1/5] Health + API routes mounted");
  const anon = makeClient();
  {
    const h = await anon.get("/health");
    check("GET /health → 200 {ok}", h.status === 200 && h.json?.data?.ok === true, h.json);
  }

  // ---- Task 2: JWT login flow ----
  console.log("\n[Task 2] JWT login flow");
  const student = makeClient();
  {
    const r = await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
    check("POST /auth/login (seed student) → 200", r.status === 200, r);
    check("login returns role=student", r.json?.data?.role === "student", r.json?.data);
    check("login set afe_session cookie", student.hasCookie());
  }
  {
    const me = await student.get("/auth/me");
    check("GET /auth/me (cookie) → student", me.status === 200 && me.json?.data?.role === "student", me.json);
  }
  {
    const bad = await anon.post("/auth/login", { login: "student@afe.edu", password: "wrong" });
    check("POST /auth/login (bad password) → 401", bad.status === 401, bad);
  }
  {
    const me = await anon.get("/auth/me");
    check("GET /auth/me (no cookie) → data:null", me.status === 200 && me.json?.data === null, me.json);
  }

  // ---- Task 4: protected routes (authn + RBAC) ----
  console.log("\n[Task 4] Protected routes / RBAC");
  {
    const r = await anon.get("/certificates/mine");
    check("GET /certificates/mine (no auth) → 401", r.status === 401, r);
  }
  {
    const r = await student.get("/analytics/teacher");
    check("GET /analytics/teacher (student) → 403", r.status === 403, r);
  }
  const teacher = makeClient();
  {
    const r = await teacher.post("/auth/login", { login: "teacher@afe.edu", password: "Teacher@123" });
    check("login teacher → 200 role=teacher", r.status === 200 && r.json?.data?.role === "teacher", r.json?.data);
    const t = await teacher.get("/analytics/teacher");
    check("GET /analytics/teacher (teacher) → 200", t.status === 200 && typeof t.json?.data?.totalStudents === "number", t.json);
  }
  const platform = makeClient();
  {
    const r = await platform.post("/auth/login", { login: "admin@afe.edu", password: "Admin@123" });
    check("login platform_admin → 200", r.status === 200 && r.json?.data?.role === "platform_admin", r.json?.data);
    const p = await platform.get("/analytics/platform");
    check("GET /analytics/platform (platform_admin) → 200", p.status === 200 && typeof p.json?.data?.totalStudents === "number", p.json);
  }

  // ---- Task 3: registration flow ----
  console.log("\n[Task 3] Registration / approval flow");
  let teacherId = "";
  {
    const dir = await anon.get("/registrations/directory");
    const ok = dir.status === 200 && Array.isArray(dir.json?.data?.teachers) && dir.json.data.teachers.length > 0;
    check("GET /registrations/directory (public) → teachers", ok, dir.json?.data);
    if (ok) teacherId = dir.json.data.teachers[0].id;
  }
  const newStudent = makeClient();
  const mobile = "9990001122";
  {
    const r = await newStudent.post("/registrations", {
      fullName: "Test Learner",
      schoolName: "Riverside High",
      email: "test.learner@example.com",
      mobileNumber: mobile,
      password: "Passw0rd!",
    });
    check("POST /registrations (new student) → 201", r.status === 201, r);
    check("registration returns pending student", r.json?.data?.registrationStatus === "pending", r.json?.data);
    check("registration set session cookie", newStudent.hasCookie());
  }
  {
    const mine = await newStudent.get("/registrations/mine");
    const ok = mine.status === 200 && mine.json?.data?.request?.status === "pending" && mine.json.data.notifications.length > 0;
    check("GET /registrations/mine → pending request + notification", ok, mine.json?.data);
  }
  let requestId = "";
  {
    const pend = await teacher.get("/registrations/queue?status=pending");
    const found = Array.isArray(pend.json?.data?.requests) && pend.json.data.requests.find((x: any) => x.mobile === mobile);
    check("GET /registrations/queue (teacher) → includes new request", !!found, pend.json?.data);
    requestId = found?.id ?? "";
  }
  {
    const dec = await teacher.post(`/registrations/${requestId}/decide`, { decision: "approved" });
    check("POST /registrations/:id/decide approve → 200", dec.status === 200 && dec.json?.data?.status === "approved", dec.json);
  }
  {
    const me = await newStudent.get("/auth/me");
    check("approved student /auth/me → registrationStatus approved", me.json?.data?.registrationStatus === "approved", me.json?.data);
  }
  {
    // wrong-school authorization: student cannot decide
    const r = await student.post(`/registrations/${requestId}/decide`, { decision: "approved" });
    check("student decide → 403 (RBAC)", r.status === 403, r);
  }

  // ---- Task 1: analytics + certificates + forum routes ----
  console.log("\n[Task 1] Analytics / Certificates / Forum routes");
  {
    const sync = await student.post("/analytics/progress", {
      topicsCompleted: 5, topicsTotal: 32, modulesCompleted: 1, modulesTotal: 8,
      assessmentsPassed: 1, avgScorePct: 80, totalTimeSec: 1200,
      moduleScores: { m1: 80 }, certificateIssued: false,
    });
    check("POST /analytics/progress (student) → ok", sync.status === 200 && sync.json?.data?.ok === true, sync.json);
  }
  {
    const r = await student.get("/certificates/mine");
    check("GET /certificates/mine (student) → 200 array", r.status === 200 && Array.isArray(r.json?.data), r.json);
  }
  {
    const r = await student.post("/certificates/issue", { courseId: "nonexistent-course" });
    check("POST /certificates/issue (not eligible) → 403", r.status === 403, r.status);
  }
  {
    const r = await anon.get("/certificates/verify/AFE-2026-NOPE0000");
    check("GET /certificates/verify/:id (public, bad) → valid:false", r.status === 200 && r.json?.data?.valid === false, r.json);
  }
  {
    const list = await student.get("/forum/threads");
    check("GET /forum/threads (student) → seeded items", list.status === 200 && list.json?.data?.items?.length > 0, list.json?.data?.total);
  }
  let threadId = "";
  {
    const c = await student.post("/forum/threads", { title: "Verify thread title", body: "Does this persist?" });
    check("POST /forum/threads (student) → created", c.status === 200 && !!c.json?.data?.id, c.json?.data);
    threadId = c.json?.data?.id ?? "";
  }
  {
    const g = await student.get(`/forum/threads/${threadId}`);
    check("GET /forum/threads/:id → thread+posts", g.status === 200 && g.json?.data?.thread?.id === threadId, g.json?.data?.thread?.id);
  }
  {
    const rep = await teacher.post(`/forum/threads/${threadId}/replies`, { body: "Teacher answer", asAnswer: true });
    check("POST reply asAnswer (teacher) → isAnswer true", rep.status === 200 && rep.json?.data?.isAnswer === true, rep.json?.data);
  }
  {
    const studentTriesModerate = await student.post(`/forum/threads/${threadId}/moderate`, { hidden: true });
    check("student moderate thread → 403 (RBAC)", studentTriesModerate.status === 403, studentTriesModerate);
    const mod = await teacher.post(`/forum/threads/${threadId}/moderate`, { hidden: true });
    check("teacher moderate thread → 200 hidden", mod.status === 200 && mod.json?.data?.hidden === true, mod.json);
  }
  {
    const logout = await student.post("/auth/logout");
    check("POST /auth/logout → ok", logout.status === 200 && logout.json?.data?.ok === true, logout.json);
  }

  // ---- summary ----
  console.log(`\n========================================`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log(`FAILURES:\n  - ${failures.join("\n  - ")}`);
  console.log(`========================================`);

  await mongo.stop();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("Harness crashed:", e);
  process.exit(1);
});
