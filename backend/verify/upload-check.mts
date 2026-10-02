// Verifies the file-upload endpoint + the `presentation` lesson content type:
// - admin can upload an allowed file → 201 with a /api/uploads/<file> URL
// - the uploaded file is served back read-only
// - RBAC: anon → 401, student → 403
// - wrong type → 415, too large → 413, missing file → 400
// - a topic can be created with contentType "presentation" pointing at the upload
// - video endpoint (/admin/uploads/video): RBAC, MP4 accepted + served with Range
//   support (206), non-video → 415, video on the document endpoint → 415, own size
//   cap → 413, and a video topic round-trips with the uploaded videoUrl
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 4123;
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
    cookie: () => cookie,
  };
}
async function uploadRaw(cookie: string, part?: { bytes: string; filename: string; type: string }, endpoint = "/admin/uploads") {
  const fd = new FormData();
  if (part) fd.append("file", new Blob([part.bytes], { type: part.type }), part.filename);
  else fd.append("note", "no file here");
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  const res = await fetch(`${BASE}${endpoint}`, { method: "POST", headers, body: fd });
  let json: any = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function up(t = 20000) { const s = Date.now(); while (Date.now()-s<t){try{if((await fetch(`${BASE}/health`)).ok)return true}catch{}await new Promise(r=>setTimeout(r,250))} return false; }

const UPLOAD_DIR = path.join(os.tmpdir(), `afe-upload-test-${Date.now()}`);
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.UPLOAD_DIR = UPLOAD_DIR;
process.env.UPLOAD_MAX_BYTES = "4096"; // small so we can exercise the size limit
process.env.UPLOAD_VIDEO_MAX_BYTES = "16384"; // larger than documents, still testable
process.env.CORS_ORIGIN = "https://app.example.vercel.app";
await (await import("./_server.mts")).startServer();
if (!(await up())) { console.error("not healthy"); process.exit(1); }

console.log("[File upload + presentation topic checks]");

const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
const student = client();
await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });

const PDF = { bytes: "%PDF-1.4\nfake slide deck\n%%EOF", filename: "deck.pdf", type: "application/pdf" };

// 1. RBAC.
check("anon upload → 401", (await uploadRaw("", PDF)).status === 401);
check("student upload → 403", (await uploadRaw(student.cookie(), PDF)).status === 403);

// 2. Admin uploads a valid PDF.
let uploadedUrl = "";
{
  const r = await uploadRaw(admin.cookie(), PDF);
  const d = r.json?.data;
  uploadedUrl = d?.url ?? "";
  check("admin upload PDF → 201", r.status === 201, r.status);
  check("returns /api/uploads/<file> URL", typeof uploadedUrl === "string" && uploadedUrl.startsWith("/api/uploads/"), d);
  check("returns metadata (originalName, size, mimetype)", d?.originalName === "deck.pdf" && typeof d?.size === "number" && d?.mimetype === "application/pdf", d);
  check("stored file exists on disk", uploadedUrl ? fs.existsSync(path.join(UPLOAD_DIR, uploadedUrl.split("/").pop()!)) : false);
}

// 3. The uploaded file is served back (read-only, no auth).
{
  const res = await fetch(`http://127.0.0.1:${PORT}${uploadedUrl}`);
  check("GET uploaded file → 200", res.status === 200, res.status);
  check("served with a pdf content-type", (res.headers.get("content-type") ?? "").includes("pdf"), res.headers.get("content-type"));
}

// 4. Validation.
check("wrong type (.txt) → 415", (await uploadRaw(admin.cookie(), { bytes: "hi", filename: "notes.txt", type: "text/plain" })).status === 415);
check("too large (> limit) → 413", (await uploadRaw(admin.cookie(), { bytes: "x".repeat(8000), filename: "big.pdf", type: "application/pdf" })).status === 413);
check("no file field → 400", (await uploadRaw(admin.cookie())).status === 400);

// 5. Presentation topic round-trip using the uploaded file.
{
  const c = (await admin.post("/admin/courses", { title: "Upload Test Course" })).json?.data;
  const m = (await admin.post(`/admin/courses/${c.id}/modules`, { title: "Module 1" })).json?.data;
  const lesson = (await admin.post(`/admin/courses/modules/${m.id}/lessons`, { title: "Presentation" })).json?.data;
  const tr = await admin.post(`/admin/courses/lessons/${lesson.id}/topics`, {
    title: "Intro Deck",
    contentType: "presentation",
    documentUrl: uploadedUrl,
  });
  check("create presentation topic → 201", tr.status === 201, tr.status);
  check("topic stored as presentation + keeps documentUrl", tr.json?.data?.contentType === "presentation" && tr.json?.data?.documentUrl === uploadedUrl, tr.json?.data);
  const tree = (await admin.get(`/admin/courses/${c.id}`)).json?.data;
  const found = tree?.modules?.[0]?.lessons?.flatMap((l: any) => l.topics)?.find((topic: any) => topic.contentType === "presentation");
  check("presentation topic appears in course tree with its file", !!found && found.documentUrl === uploadedUrl, found);
}

// 6. Lesson video uploads.
{
  const VIDEO_EP = "/admin/uploads/video";
  // ftyp box header → a tiny (non-playable) MP4; content isn't inspected, only ext + MIME.
  const MP4 = { bytes: "\u0000\u0000\u0000\u0018ftypmp42" + "v".repeat(6000), filename: "intro.mp4", type: "video/mp4" };

  check("anon video upload → 401", (await uploadRaw("", MP4, VIDEO_EP)).status === 401);
  check("student video upload → 403", (await uploadRaw(student.cookie(), MP4, VIDEO_EP)).status === 403);

  const r = await uploadRaw(admin.cookie(), MP4, VIDEO_EP);
  const videoUrl: string = r.json?.data?.url ?? "";
  check("admin upload MP4 (bigger than the document cap) → 201", r.status === 201, r.status);
  check("video returns /api/uploads/<file>.mp4 URL", videoUrl.startsWith("/api/uploads/") && videoUrl.endsWith(".mp4"), r.json);
  check("video metadata mimetype video/mp4", r.json?.data?.mimetype === "video/mp4", r.json?.data);

  const full = await fetch(`http://127.0.0.1:${PORT}${videoUrl}`);
  check("GET uploaded video → 200 with video/mp4", full.status === 200 && (full.headers.get("content-type") ?? "").includes("video/mp4"), full.headers.get("content-type"));
  const ranged = await fetch(`http://127.0.0.1:${PORT}${videoUrl}`, { headers: { range: "bytes=0-99" } });
  check("Range request → 206 Partial Content (seekable)", ranged.status === 206 && (await ranged.arrayBuffer()).byteLength === 100, ranged.status);

  check("WebM accepted → 201", (await uploadRaw(admin.cookie(), { bytes: "webm", filename: "clip.webm", type: "video/webm" }, VIDEO_EP)).status === 201);
  check("PDF on video endpoint → 415", (await uploadRaw(admin.cookie(), PDF, VIDEO_EP)).status === 415);
  check("MP4 on document endpoint → 415", (await uploadRaw(admin.cookie(), { bytes: "x", filename: "a.mp4", type: "video/mp4" })).status === 415);
  check("mismatched ext/MIME (.mp4 as text/plain) → 415", (await uploadRaw(admin.cookie(), { bytes: "x", filename: "a.mp4", type: "text/plain" }, VIDEO_EP)).status === 415);
  check("video over its cap → 413", (await uploadRaw(admin.cookie(), { bytes: "v".repeat(20000), filename: "huge.mp4", type: "video/mp4" }, VIDEO_EP)).status === 413);
  check("no file on video endpoint → 400", (await uploadRaw(admin.cookie(), undefined, VIDEO_EP)).status === 400);

  const c = (await admin.post("/admin/courses", { title: "Video Test Course" })).json?.data;
  const m = (await admin.post(`/admin/courses/${c.id}/modules`, { title: "Module V" })).json?.data;
  const lesson = (await admin.post(`/admin/courses/modules/${m.id}/lessons`, { title: "Video" })).json?.data;
  const tr = await admin.post(`/admin/courses/lessons/${lesson.id}/topics`, { title: "Intro Video", contentType: "video", videoUrl });
  check("create video topic with uploaded videoUrl → 201", tr.status === 201 && tr.json?.data?.videoUrl === videoUrl, tr.json);
}

// 7. Direct-to-backend uploads (frontend on another origin): upload-scoped token + CORS.
{
  const t = await admin.post("/admin/uploads/token");
  const token: string = t.json?.data?.token ?? "";
  check("admin gets an upload token → 200", t.status === 200 && token.length > 20, t.status);
  check("student cannot get an upload token → 403", (await student.post("/admin/uploads/token")).status === 403);

  const fd = new FormData();
  fd.append("file", new Blob(["%PDF-1.4 direct"], { type: "application/pdf" }), "direct.pdf");
  const direct = await fetch(`${BASE}/admin/uploads`, { method: "POST", headers: { authorization: `Bearer ${token}`, origin: "https://app.example.vercel.app" }, body: fd });
  check("upload with Bearer upload-token (no cookie) → 201", direct.status === 201, direct.status);
  check("CORS: allowed origin echoed on upload response", direct.headers.get("access-control-allow-origin") === "https://app.example.vercel.app", direct.headers.get("access-control-allow-origin"));

  const misuse = await fetch(`${BASE}/admin/courses`, { headers: { authorization: `Bearer ${token}` } });
  check("upload token rejected on non-upload endpoints → 401", misuse.status === 401, misuse.status);

  const pre = await fetch(`${BASE}/admin/uploads/video`, { method: "OPTIONS", headers: { origin: "https://app.example.vercel.app", "access-control-request-method": "POST", "access-control-request-headers": "authorization" } });
  check("CORS preflight from allowed origin → 204 + Allow-Headers", pre.status === 204 && (pre.headers.get("access-control-allow-headers") ?? "").toLowerCase().includes("authorization"), pre.status);
  const bad = await fetch(`${BASE}/admin/uploads/video`, { method: "OPTIONS", headers: { origin: "https://evil.example.com", "access-control-request-method": "POST" } });
  check("CORS preflight from other origin → 403, no allow-origin", bad.status === 403 && !bad.headers.get("access-control-allow-origin"), bad.status);
  check("API JSON responses are Cache-Control: no-store", (await fetch(`${BASE}/courses`)).headers.get("cache-control") === "no-store");
}

console.log(`\nUPLOAD CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
try { fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
