// Performance benchmark (not pass/fail): boots the real backend in-process against
// an in-memory MongoDB reached through a TCP proxy that adds latency to every
// database reply (default 50 ms round trip — roughly app server ↔ Atlas in another
// region) and counts database round trips. Seeds the flagship course, then times
// the hot endpoints and prints median latency + DB round trips per request.
//
//   npx tsx verify/perf-bench.mts            # 50 ms DB round trip
//   DB_RTT_MS=0 npx tsx verify/perf-bench.mts
import net from "node:net";
import { MongoMemoryServer } from "mongodb-memory-server";

const RTT = Number(process.env.DB_RTT_MS ?? 50);
const RUNS = Number(process.env.RUNS ?? 7);
const PORT = 4140;
const BASE = `http://127.0.0.1:${PORT}/api`;

// ── Latency proxy: counts client→server wire messages (one per DB command) ──────
let dbMessages = 0;
const mongo = await MongoMemoryServer.create();
const target = new URL(mongo.getUri());
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const proxy = net.createServer((client) => {
  const server = net.connect(Number(target.port), target.hostname);
  let pending = Buffer.alloc(0);
  client.on("data", async (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 4 && pending.length >= pending.readInt32LE(0)) {
      const len = pending.readInt32LE(0);
      const msg = pending.subarray(0, len);
      pending = pending.subarray(len);
      dbMessages++;
      server.write(msg);
    }
  });
  // Apply the whole round trip on the reply path, preserving order.
  let chain = Promise.resolve();
  server.on("data", (chunk) => {
    chain = chain.then(async () => {
      if (RTT) await delay(RTT);
      client.write(chunk);
    });
  });
  client.on("error", () => server.destroy());
  server.on("error", () => client.destroy());
  client.on("close", () => server.destroy());
  server.on("close", () => client.destroy());
});
await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
const proxyPort = (proxy.address() as net.AddressInfo).port;

process.env.MONGODB_URI = `mongodb://127.0.0.1:${proxyPort}/ai-spark?directConnection=true`;
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
await (await import("./_server.mts")).startServer();
await fetch(`${BASE}/health`);
const { seedAiCourse } = await import("../server/seed/course.seed.ts");
await seedAiCourse();

let cookie = "";
async function call(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  for (const sc of res.headers.getSetCookie?.() ?? []) if (sc.startsWith("afe_session=")) cookie = sc.split(";")[0];
  const text = await res.text();
  return { status: res.status, bytes: text.length, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

const tree = (await call("GET", "/courses/demystifying-ai-for-everyone")).json.data;
const topics: string[] = tree.modules.flatMap((m: any) => m.lessons.flatMap((l: any) => l.topics.map((t: any) => t.id)));
await call("POST", "/auth/login", { login: "student@afe.edu", password: "Student@123" });

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows: string[][] = [];
async function bench(label: string, fn: (i: number) => Promise<{ status: number; bytes: number }>) {
  await fn(-1); // warm-up
  const times: number[] = [];
  const msgs: number[] = [];
  let bytes = 0;
  let status = 0;
  for (let i = 0; i < RUNS; i++) {
    const before = dbMessages;
    const t0 = performance.now();
    const r = await fn(i);
    times.push(performance.now() - t0);
    msgs.push(dbMessages - before);
    bytes = r.bytes;
    status = r.status;
  }
  rows.push([label, String(status), `${median(times).toFixed(0)} ms`, String(median(msgs)), `${(bytes / 1024).toFixed(1)} KB`]);
}

const cid = tree.id;
await bench("GET /courses/:slug (full tree)", () => call("GET", "/courses/demystifying-ai-for-everyone"));
await bench("GET /courses/:slug?view=outline", () => call("GET", "/courses/demystifying-ai-for-everyone?view=outline"));
await bench("GET /courses/:slug/topics/:id", () => call("GET", `/courses/demystifying-ai-for-everyone/topics/${topics[0]}`));
await bench("GET /branding", () => call("GET", "/branding"));
await bench("GET /auth/me", () => call("GET", "/auth/me"));
await bench("GET /progress/:courseId", () => call("GET", `/progress/${cid}`));
await bench("POST /progress/:id/visit", () => call("POST", `/progress/${cid}/visit`, { topicId: topics[0] }));
await bench("POST /progress/:id/time", () => call("POST", `/progress/${cid}/time`, { minutes: 1 }));
let done = 0;
await bench("POST complete topic (next in sequence)", () => call("POST", `/progress/${cid}/topics/${topics[done++]}/complete`, undefined));

const widths = [40, 7, 10, 10, 10];
const fmt = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join(" ");
console.log(`\n[perf] DB round trip ${RTT} ms · median of ${RUNS} · ${topics.length} topics`);
console.log(fmt(["endpoint", "status", "latency", "DB trips", "payload"]));
for (const r of rows) console.log(fmt(r));
proxy.close();
await mongo.stop();
process.exit(0);
