// Verifies topic content + media:
// - topics store text, audio, document, video and subtitles together inside lesson containers
// - local-storage uploads for every kind (incl. a >10 MB body — regression for the
//   middleware body-truncation bug) with upload tokens + CORS, served with Range
// - POST /api/admin/uploads/presign: local mode, R2 mode (presigned PUT bound to
//   Content-Type + Content-Length, public URL), 415/413/RBAC
// - text-to-speech: 503 when unconfigured; Workers AI (fake) → chunked synthesis →
//   MP3 stored locally or in R2 (fake S3), both raw-audio and JSON-base64 responses
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";
import { publishModule } from "./_fixtures.mts";

const PORT = 4141;
const BASE = `http://127.0.0.1:${PORT}/api`;
const FRONTEND = "https://app.example.vercel.app";
let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`); }
}
function client() {
  let cookie = "";
  async function req(method: string, p: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers["cookie"] = cookie;
    const res = await fetch(`${BASE}${p}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const sc of res.headers.getSetCookie?.() ?? []) if (sc.startsWith("afe_session=")) cookie = sc.split(";")[0];
    let json: any = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b), patch: (p: string, b?: unknown) => req("PATCH", p, b) };
}
async function multipart(p: string, token: string, bytes: Uint8Array | string, filename: string, type: string) {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type }), filename);
  const res = await fetch(`${BASE.replace("/api", "")}${p}`, { method: "POST", headers: { authorization: `Bearer ${token}`, origin: FRONTEND }, body: fd });
  let json: any = null; try { json = await res.json(); } catch {}
  return { status: res.status, json, headers: res.headers };
}

// --- fake Cloudflare endpoints -------------------------------------------------
const s3Objects = new Map<string, { type: string; bytes: Buffer }>();
const aiCalls: unknown[] = [];
let aiMode: "binary" | "json" | "wav" = "binary";
/** A tiny 16-bit mono PCM WAV whose samples are all `fill` (like MeloTTS output). */
function wav(samples: number, fill: number): Buffer {
  const data = Buffer.alloc(samples * 2, fill);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(44100, 24); h.writeUInt32LE(88200, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const fake = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    if (req.method === "PUT") { // S3 PutObject (path-style /<bucket>/<key>)
      s3Objects.set(req.url!.split("?")[0], { type: String(req.headers["content-type"]), bytes: body });
      res.writeHead(200, { ETag: '"fake"' }).end();
      return;
    }
    if (req.url!.includes("/ai/run/")) { // Workers AI
      aiCalls.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body.toString()) });
      const mp3 = Buffer.from(`ID3-chunk-${aiCalls.length};`);
      if (aiMode === "wav") res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ result: { audio: wav(100 * aiCalls.length, aiCalls.length).toString("base64") } }));
      else if (aiMode === "binary") res.writeHead(200, { "content-type": "audio/mpeg" }).end(mp3);
      else res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ success: true, result: { audio: mp3.toString("base64") } }));
      return;
    }
    res.writeHead(404).end();
  });
});
await new Promise<void>((r) => fake.listen(4142, "127.0.0.1", r));
const FAKE = "http://127.0.0.1:4142";

const UPLOAD_DIR = path.join(os.tmpdir(), `afe-media-test-${Date.now()}`);
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri("ai-spark");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = FRONTEND;
process.env.UPLOAD_DIR = UPLOAD_DIR;
process.env.UPLOAD_AUDIO_MAX_BYTES = String(20 * 1024 * 1024);
for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL", "R2_ENDPOINT", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_TOKEN"]) delete process.env[k];
await (await import("./_server.mts")).startServer(PORT);
if (!(await fetch(`${BASE}/health`)).ok) { console.error("not healthy"); process.exit(1); }

console.log("[Lesson media checks]");
const admin = client();
await admin.post("/auth/login", { login: "Moocs@admin", password: "Admin@123" });
const student = client();
await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });

// 1. Multi-part topic round-trip.
{
  const c = (await admin.post("/admin/courses", { title: "Media Course" })).json?.data;
  const m = (await admin.post(`/admin/courses/${c.id}/modules`, { title: "Module M" })).json?.data;
  const lesson = await admin.post(`/admin/courses/modules/${m.id}/lessons`, { title: "Everything lesson" });
  const parts = {
    title: "Everything topic", contentType: "video", content: "## Hello\n\nSome text.",
    videoUrl: "https://media.example.com/video/a.mp4", subtitleUrl: "https://media.example.com/subtitle/a.vtt",
    audioUrl: "https://media.example.com/audio/a.mp3", documentUrl: "https://media.example.com/document/a.pptx",
  };
  const tr = await admin.post(`/admin/courses/lessons/${lesson.json?.data?.id}/topics`, parts);
  const topic = tr.json?.data;
  check("create topic with text + audio + document + video + subtitles → 201", tr.status === 201 && topic?.audioUrl === parts.audioUrl && topic?.subtitleUrl === parts.subtitleUrl && topic?.documentUrl === parts.documentUrl && topic?.videoUrl === parts.videoUrl && topic?.content === parts.content, topic);
  const up = await admin.patch(`/admin/courses/topics/${topic.id}`, { audioUrl: "", subtitleUrl: "https://media.example.com/subtitle/b.vtt" });
  check("patch topic media fields (clear audio, swap subtitles)", up.status === 200 && up.json?.data?.audioUrl === "" && up.json?.data?.subtitleUrl.endsWith("b.vtt"), up.json);
  await publishModule(admin, m.id);
  await admin.post(`/admin/courses/${c.id}/publish`);
  // Learners' course trees carry no media links; the topic endpoint serves them
  // once the topic is unlocked for the student.
  const pub = await student.get(`/courses/${c.slug}`);
  const listed = pub.json?.data?.modules?.[0]?.lessons?.[0]?.topics?.[0];
  check("course tree withholds media links from students", listed && listed.videoUrl === "" && listed.subtitleUrl === "" && listed.hasVideo === true, listed);
  const seen = (await student.get(`/courses/${c.slug}/topics/${topic.id}`)).json?.data?.topic;
  check("students receive topic subtitleUrl/audioUrl from the topic endpoint", seen?.subtitleUrl?.endsWith("b.vtt") && seen?.audioUrl === "", seen);
}

// 2. Presign — local mode (no R2).
{
  check("student cannot presign → 403", (await student.post("/admin/uploads/presign", { kind: "video", filename: "a.mp4", contentType: "video/mp4", size: 10 })).status === 403);
  const cfg = await admin.get("/admin/uploads/config");
  check("config reports local storage + TTS off", cfg.json?.data?.storage === "local" && cfg.json?.data?.tts === false, cfg.json);
  const p = await admin.post("/admin/uploads/presign", { kind: "audio", filename: "n.mp3", contentType: "audio/mpeg", size: 1234 });
  check("presign (local) → uploadPath + upload token", p.json?.data?.mode === "local" && p.json?.data?.uploadPath === "/api/admin/uploads/audio" && p.json?.data?.token?.length > 20, p.json);
  check("presign rejects wrong type → 415", (await admin.post("/admin/uploads/presign", { kind: "video", filename: "a.exe", contentType: "application/x-msdownload", size: 10 })).status === 415);
  check("presign rejects mismatched kind (mp3 as video) → 415", (await admin.post("/admin/uploads/presign", { kind: "video", filename: "a.mp3", contentType: "audio/mpeg", size: 10 })).status === 415);
  check("presign rejects too large → 413", (await admin.post("/admin/uploads/presign", { kind: "subtitle", filename: "a.vtt", contentType: "text/vtt", size: 50 * 1024 * 1024 })).status === 413);
  check("presign rejects bad kind → 400", (await admin.post("/admin/uploads/presign", { kind: "zip", filename: "a.zip", contentType: "application/zip", size: 10 })).status === 400);

  // 3. Local uploads of each new kind, incl. a >10 MB body (middleware truncation regression).
  const token = p.json.data.token;
  const big = new Uint8Array(12 * 1024 * 1024).fill(7);
  const a = await multipart("/api/admin/uploads/audio", token, big, "lecture.mp3", "audio/mpeg");
  check("12 MB audio upload (body > 10 MB) → 201, stored in full", a.status === 201 && a.json?.data?.size === big.length, { status: a.status, json: a.json });
  check("upload response carries CORS for the frontend origin", a.headers.get("access-control-allow-origin") === FRONTEND);
  const pre = await fetch(`${BASE}/admin/uploads/audio`, { method: "OPTIONS", headers: { origin: FRONTEND, "access-control-request-method": "POST", "access-control-request-headers": "authorization" } });
  check("CORS preflight on /admin/uploads/audio → 204", pre.status === 204);
  const ranged = await fetch(`http://127.0.0.1:${PORT}${a.json?.data?.url}`, { headers: { range: "bytes=0-9" } });
  check("uploaded audio served with Range → 206 audio/mpeg", ranged.status === 206 && (ranged.headers.get("content-type") ?? "").startsWith("audio/mpeg"));

  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.500\nHello world\n";
  const s = await multipart("/api/admin/uploads/subtitle", token, vtt, "captions.vtt", "text/vtt");
  check("subtitle (.vtt) upload → 201", s.status === 201, s.json);
  const sub = await fetch(`http://127.0.0.1:${PORT}${s.json?.data?.url}`);
  check("subtitles served as text/vtt with Access-Control-Allow-Origin: *", (sub.headers.get("content-type") ?? "").startsWith("text/vtt") && sub.headers.get("access-control-allow-origin") === "*" && (await sub.text()) === vtt);
  check("raw .srt rejected by the subtitle endpoint (converted client-side) → 415", (await multipart("/api/admin/uploads/subtitle", token, "1\n00:00:01,000 --> 00:00:02,000\nHi\n", "c.srt", "application/x-subrip")).status === 415);
  check("pptx accepted as a document → 201", (await multipart("/api/admin/uploads", token, "PK\u0003\u0004deck", "slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation")).status === 201);
}

// 4. Presign — Cloudflare R2 mode (fake account; signing is offline).
{
  Object.assign(process.env, {
    R2_ACCOUNT_ID: "acct123", R2_ACCESS_KEY_ID: "AKIDEXAMPLE", R2_SECRET_ACCESS_KEY: "secretsecretsecret",
    R2_BUCKET: "lesson-media", R2_PUBLIC_URL: "https://media.example.com/",
  });
  const cfg = await admin.get("/admin/uploads/config");
  check("config reports r2 storage when R2_* are set", cfg.json?.data?.storage === "r2", cfg.json);
  const p = await admin.post("/admin/uploads/presign", { kind: "video", filename: "Intro Lecture.mp4", contentType: "video/mp4", size: 314572800 });
  const d = p.json?.data;
  const u = d?.uploadUrl ? new URL(d.uploadUrl) : null;
  check("presign (r2) → PUT URL on <account>.r2.cloudflarestorage.com/<bucket>/video/…", d?.mode === "r2" && u?.host === "acct123.r2.cloudflarestorage.com" && u.pathname.startsWith("/lesson-media/video/") && u.pathname.endsWith(".mp4"), d);
  const signed = u?.searchParams.get("X-Amz-SignedHeaders") ?? "";
  check("signature binds content-length + content-type", signed.includes("content-length") && signed.includes("content-type"), signed);
  check("presigned URL expires in 1 hour", u?.searchParams.get("X-Amz-Expires") === "3600");
  check("public URL = R2_PUBLIC_URL + same key (no double slash)", d?.url === `https://media.example.com/${u?.pathname.replace("/lesson-media/", "")}`, d?.url);
  check("client must send the signed Content-Type", d?.headers?.["Content-Type"] === "video/mp4");
}

// 5. Text-to-speech.
{
  const text = "# Welcome\n\n" + "AI systems learn patterns from data. ".repeat(60) + "\n\n- **Bold** point\n- [A link](https://x.y)";
  check("TTS without credentials → 503", (await admin.post("/admin/tts", { text })).status === 503);
  check("student cannot use TTS → 403", (await student.post("/admin/tts", { text })).status === 403);

  // R2 + Workers AI (fake endpoints).
  Object.assign(process.env, { R2_ENDPOINT: FAKE, CLOUDFLARE_ACCOUNT_ID: "acct123", CLOUDFLARE_AI_TOKEN: "ai-token", CLOUDFLARE_API_BASE: `${FAKE}/client/v4` });
  const r = await admin.post("/admin/tts", { text });
  const d = r.json?.data;
  check("TTS → 201 with an R2 public URL for an .mp3 under audio/", r.status === 201 && d?.url?.startsWith("https://media.example.com/audio/") && d?.url.endsWith(".mp3"), r.json);
  check("long text was split into several synthesis requests", d?.chunks > 1 && aiCalls.length === d?.chunks, { chunks: d?.chunks, calls: aiCalls.length });
  const first = aiCalls[0] as { url: string; auth: string; body: { text: string; speaker: string } };
  check("default: Deepgram Aura-2 with the male voice 'orion' ({ text, speaker }), Bearer token", first?.url.endsWith("/accounts/acct123/ai/run/@cf/deepgram/aura-2-en") && first.auth === "Bearer ai-token" && first.body.speaker === "orion" && typeof first.body.text === "string", first);
  check("response reports the voice used", d?.voice === "orion");
  check("markdown stripped before narration (no #, **, link URLs)", !(aiCalls as any[]).some((c) => /[#*]|https?:/.test(c.body.text)));
  const cfgV = (await admin.get("/admin/uploads/config")).json?.data;
  check("config lists voices (male + female) with default 'orion'", cfgV?.tts === true && cfgV?.ttsDefaultVoice === "orion" && cfgV?.ttsVoices?.some((v: any) => v.gender === "male") && cfgV?.ttsVoices?.some((v: any) => v.gender === "female"), cfgV);
  aiCalls.length = 0;
  const chosen = await admin.post("/admin/tts", { text: "Hello there.", voice: "arcas" });
  check("admin-chosen voice is sent to Workers AI", chosen.status === 201 && (aiCalls[0] as any)?.body?.speaker === "arcas" && chosen.json?.data?.voice === "arcas", chosen.json);
  check("unknown voice rejected → 400", (await admin.post("/admin/tts", { text: "Hi.", voice: "robot9000" })).status === 400);

  // MeloTTS (single voice) still supported via TTS_MODEL.
  process.env.TTS_MODEL = "@cf/myshell-ai/melotts";
  aiCalls.length = 0;
  const melo = await admin.post("/admin/tts", { text: "Hello from Melo." });
  const mb = (aiCalls[0] as any)?.body;
  check("TTS_MODEL=melotts → { prompt, lang } and no voice", melo.status === 201 && mb?.prompt === "Hello from Melo." && mb?.lang === "en" && mb?.speaker === undefined && melo.json?.data?.voice === null, { body: mb, data: melo.json?.data });
  check("config has no voice list for single-voice models", ((await admin.get("/admin/uploads/config")).json?.data?.ttsVoices ?? []).length === 0);
  delete process.env.TTS_MODEL;
  const key = d?.url?.replace("https://media.example.com/", "");
  const obj = s3Objects.get(`/lesson-media/${key}`);
  const expected = Array.from({ length: d?.chunks ?? 0 }, (_, i) => `ID3-chunk-${i + 1};`).join("");
  check("MP3 chunks concatenated in order and PUT to R2 as audio/mpeg", obj?.type === "audio/mpeg" && obj?.bytes.toString() === expected, { type: obj?.type, size: obj?.bytes.length });

  // Local storage + JSON-base64 response variant.
  for (const k of ["R2_ACCOUNT_ID", "R2_BUCKET"]) delete process.env[k];
  aiMode = "json";
  aiCalls.length = 0;
  const r2 = await admin.post("/admin/tts", { text: "Short lesson text. Second sentence." });
  check("TTS (local storage, base64 JSON response) → /api/uploads/….mp3", r2.status === 201 && r2.json?.data?.url?.startsWith("/api/uploads/") && r2.json?.data?.chunks === 1, r2.json);
  const got = await fetch(`http://127.0.0.1:${PORT}${r2.json?.data?.url}`);
  check("generated audio served back with audio/mpeg", (got.headers.get("content-type") ?? "").startsWith("audio/mpeg") && (await got.text()) === "ID3-chunk-1;");
  check("TTS rejects empty text → 400", (await admin.post("/admin/tts", { text: "   " })).status === 400);

  // WAV output (what MeloTTS actually returns): chunks merged into ONE valid WAV.
  aiMode = "wav";
  aiCalls.length = 0;
  const w = await admin.post("/admin/tts", { text: "Sentence one is here. ".repeat(80) });
  const wd = w.json?.data;
  check("TTS with WAV chunks → 201, .wav file, audio/wav", w.status === 201 && wd?.url?.endsWith(".wav") && wd?.contentType === "audio/wav" && wd?.chunks > 1, w.json);
  const wf = Buffer.from(await (await fetch(`http://127.0.0.1:${PORT}${wd?.url}`)).arrayBuffer());
  const n = wd?.chunks ?? 0;
  const expectedData = Array.from({ length: n }, (_, i) => 100 * (i + 1) * 2).reduce((a, b) => a + b, 0);
  check("merged WAV has one RIFF header with the combined data size", wf.toString("latin1", 0, 4) === "RIFF" && wf.readUInt32LE(4) === wf.length - 8 && wf.toString("latin1", 36, 40) === "data" && wf.readUInt32LE(40) === expectedData && wf.length === 44 + expectedData, { len: wf.length, data: wf.readUInt32LE(40), expectedData });
  check("merged WAV keeps chunk order (samples of chunk 1, then 2, …)", wf[44] === 1 && wf[44 + 200] === 2 && wf[wf.length - 1] === n);
}

console.log(`\nMEDIA CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await mongo.stop();
fake.close();
try { fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
