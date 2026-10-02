// Verifies the Course → Module → Lesson → Topic data migration on OLD-shape data
// (content "lessons" with contentType, progress.completedLessons, analytics
// lessonsCompleted) written straight into Mongo, then the real backend is started:
// - old content lessons become topics with the SAME ids, grouped in one container
//   lesson per module (named after the old lesson when there was only one)
// - progress fields are renamed and the student's completions still count
// - analytics fields are renamed; courses get their three sections
// - running the migration again changes nothing (idempotent)
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

const PORT = 4161;
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

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri("ai-spark");
process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.NODE_ENV = "test";

// ---- Old-shape data, written directly (as it exists in pre-migration databases) ----
const conn = await mongoose.createConnection(uri).asPromise();
const db = conn.db!;
const oid = () => new mongoose.Types.ObjectId();
const courseId = oid(), m1 = oid(), m2 = oid();
const l1 = oid(), l2 = oid(), l3 = oid(); // OLD content lessons
const now = new Date();
await db.collection("courses").insertOne({ _id: courseId, title: "Legacy Course", slug: "legacy-course", status: "published", deletedAt: null, description: "", shortDescription: "", instructor: "", level: "beginner", tags: [], learningObjectives: [], prerequisites: [], createdBy: "u-platform-admin", createdAt: now, updatedAt: now });
await db.collection("modules").insertMany([
  { _id: m1, courseId: String(courseId), title: "Module One", description: "d1", learningObjectives: ["o1"], order: 0, isPublished: true, createdAt: now, updatedAt: now },
  { _id: m2, courseId: String(courseId), title: "Module Two", description: "d2", learningObjectives: ["o2"], order: 1, isPublished: true, createdAt: now, updatedAt: now },
]);
await db.collection("lessons").insertMany([
  { _id: l1, moduleId: String(m1), courseId: String(courseId), title: "Old Lesson A", description: "first", order: 0, contentType: "video", videoUrl: "https://x/v.mp4", subtitleUrl: "", audioUrl: "", documentUrl: "", content: "", estimatedDurationMinutes: 5, isPreview: false, createdAt: now, updatedAt: now },
  { _id: l2, moduleId: String(m1), courseId: String(courseId), title: "Old Lesson B", description: "", order: 1, contentType: "rich_text", content: "# B", videoUrl: "", subtitleUrl: "", audioUrl: "", documentUrl: "", estimatedDurationMinutes: 5, isPreview: false, createdAt: now, updatedAt: now },
  { _id: l3, moduleId: String(m2), courseId: String(courseId), title: "Only Lesson C", description: "solo", order: 0, contentType: "pdf", documentUrl: "https://x/c.pdf", videoUrl: "", subtitleUrl: "", audioUrl: "", content: "", estimatedDurationMinutes: 5, isPreview: false, createdAt: now, updatedAt: now },
]);
await db.collection("progresses").insertOne({ studentId: "u-student", courseId: String(courseId), completedLessons: [String(l1)], lastVisitedLessonId: String(l1), completedModules: [], assessmentScores: [], timeSpentMinutes: 3, overallProgress: 33, certificateEligible: false, createdAt: now, updatedAt: now });
await db.collection("analyticssnapshots").insertOne({ studentUserId: "u-legacy", studentName: "Legacy", schoolName: "S", teacherId: "u-teacher", lessonsCompleted: 2, lessonsTotal: 3, modulesCompleted: 0, modulesTotal: 2, quizzesTaken: 0, quizzesPassed: 0, totalTimeSec: 10, updatedAt: now.toISOString() });

// ---- Start the backend: ensureServerReady() runs the migration ----
await (await import("./_server.mts")).startServer(PORT);
if (!(await fetch(`${BASE}/health`)).ok) { console.error("not healthy"); process.exit(1); }

console.log("[Lesson → Topic migration]");
{
  const lessonsLeft = await db.collection("lessons").countDocuments({ contentType: { $exists: true } });
  check("no old content docs left in `lessons`", lessonsLeft === 0, lessonsLeft);
  const topics = await db.collection("topics").find().sort({ order: 1 }).toArray();
  const ids = topics.map((t) => String(t._id)).sort();
  check("old lessons became topics with the SAME ids", JSON.stringify(ids) === JSON.stringify([String(l1), String(l2), String(l3)].sort()), ids);
  const containers = await db.collection("lessons").find().toArray();
  check("one container lesson per module", containers.length === 2 && new Set(containers.map((c) => c.moduleId)).size === 2, containers.map((c) => c.title));
  const c1 = containers.find((c) => c.moduleId === String(m1));
  const c2 = containers.find((c) => c.moduleId === String(m2));
  check("module with several old lessons → container 'Lesson 1'", c1?.title === "Lesson 1", c1?.title);
  check("module with one old lesson → container named after it", c2?.title === "Only Lesson C" && c2?.description === "solo", c2);
  const tA = topics.find((t) => String(t._id) === String(l1));
  const tB = topics.find((t) => String(t._id) === String(l2));
  check("topics point at their container, keep content + order", tA?.lessonId === String(c1?._id) && tA?.videoUrl === "https://x/v.mp4" && tA?.order === 0 && tB?.order === 1 && tB?.content === "# B", { tA, tB });

  const p = await db.collection("progresses").findOne({ studentId: "u-student" });
  check("progress renamed: completedTopics + lastVisitedTopicId", JSON.stringify(p?.completedTopics) === JSON.stringify([String(l1)]) && p?.lastVisitedTopicId === String(l1) && p?.completedLessons === undefined, p);
  const a = await db.collection("analyticssnapshots").findOne({ studentUserId: "u-legacy" });
  check("analytics renamed: topicsCompleted/topicsTotal", a?.topicsCompleted === 2 && a?.topicsTotal === 3 && a?.lessonsCompleted === undefined, a);
  const sections = await db.collection("coursesections").find({ courseId: String(courseId) }).toArray();
  check("course got its 3 sections", sections.map((s) => s.kind).sort().join() === "instructor,introduction,overview", sections.map((s) => s.kind));
}

// ---- The migrated course works through the API ----
{
  const student = client();
  await student.post("/auth/login", { login: "student@afe.edu", password: "Student@123" });
  const tree = (await student.get("/courses/legacy-course")).json?.data;
  const mod1 = tree?.modules?.find((m: any) => m.id === String(m1));
  check("tree: sections + modules → lessons → topics", tree?.sections?.length === 3 && mod1?.lessons?.[0]?.topics?.map((t: any) => t.title).join() === "Old Lesson A,Old Lesson B", { s: tree?.sections?.length, l: mod1?.lessons });
  const prog = (await student.get(`/progress/${courseId}`)).json?.data;
  check("student's old completion still counts (1 of 3 topics, next = B)", prog?.totalTopics === 3 && prog?.nextTopicId === String(l2) && prog?.progress?.completedTopics?.length === 1, prog);
  const done = await student.post(`/progress/${courseId}/topics/${l2}/complete`);
  check("next topic can be completed (sequence intact)", done.status === 200 && done.json?.data?.progress?.completedModules?.includes(String(m1)), done.json);
}

// ---- Idempotent ----
{
  const { migrateLessonsToTopics } = await import("../server/migrations/lessons-to-topics.ts");
  const again = await migrateLessonsToTopics();
  const counts = [await db.collection("topics").countDocuments(), await db.collection("lessons").countDocuments(), await db.collection("coursesections").countDocuments({ courseId: String(courseId) })];
  check("re-running the migration changes nothing", again.topics === 0 && JSON.stringify(counts) === "[3,2,3]", { again, counts });
}

console.log(`\nMIGRATION CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("FAILURES:\n  - " + failures.join("\n  - "));
await conn.close();
await mongo.stop();
process.exit(fail ? 1 : 0);
