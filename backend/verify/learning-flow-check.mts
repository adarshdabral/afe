// Verifies the lesson → assignment → module assessment → next module flow, all
// enforced by the backend:
//   - lesson assignments (Assessment kind "lesson"): admin CRUD, non-graded by
//     default, unified config validation, one per lesson, alongside the module's
//     one assessment (index migration)
//   - the learning sequence: topics → required assignment → module assessment;
//     locked items are refused by the topic, completion, assessment, discussion
//     reply and download endpoints (403/409), not just hidden in the UI
//   - module unlock: Module 2 stays locked until Module 1's topics, required
//     assignment AND graded assessment are complete
//   - server-timed attempts: questions hidden until start, deadline set by the
//     server, resume after "refresh", autosave, late submit refused (saved answers
//     submitted instead), expired attempt auto-graded on the next progress read,
//     attempt limit, availability window, shuffling
//   - discussion topics: linked forum thread, required participation
//   - downloads: per-topic switch, text attachment, local-storage redirect,
//     external links refused, learners' course tree carries no content
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { publishModule, READY_QUESTION } from "./_fixtures.mts";

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
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    for (const sc of res.headers.getSetCookie?.() ?? []) if (sc.startsWith("afe_session=")) cookie = sc.split(";")[0];
    const text = await res.text();
    let json: any = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
  return {
    get: (p: string) => req("GET", p),
    post: (p: string, b?: unknown) => req("POST", p, b),
    patch: (p: string, b?: unknown) => req("PATCH", p, b),
    put: (p: string, b?: unknown) => req("PUT", p, b),
    login: (l: string, pw: string) => req("POST", "/auth/login", { login: l, password: pw }),
  };
}
async function waitForHealth(t = 20000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  return false;
}

const mongo = await MongoMemoryServer.create();
const URI = mongo.getUri("ai-spark");
process.env.MONGODB_URI = URI;
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:3000";
// A database from BEFORE lesson assignments: the old unique moduleId index and an
// assessment without `kind`. The startup migration must convert it.
{
  const pre = new MongoClient(URI);
  await pre.connect();
  const col = pre.db().collection("assessments");
  await col.createIndex({ moduleId: 1 }, { unique: true, name: "moduleId_1" });
  await col.insertOne({ moduleId: "legacy-module", courseId: "legacy-course", title: "Legacy quiz", passingScore: 60, isPublished: true });
  await pre.close();
}
await (await import("./_server.mts")).startServer();
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }
// Direct DB access — only to move a deadline into the past (instead of waiting minutes).
const db = new MongoClient(URI);
await db.connect();
const attempts = db.db().collection("attempts");
const expire = async (attemptId: string) =>
  attempts.updateOne({ _id: new ObjectId(attemptId) }, { $set: { deadline: new Date(Date.now() - 60_000) } });

console.log("[Learning flow checks]");
{
  const col = db.db().collection("assessments");
  const idx = await col.indexes();
  check("migration: legacy unique moduleId index replaced", !idx.some((i) => i.name === "moduleId_1" && i.unique) && idx.some((i) => i.name === "module_assessment_unique") && idx.some((i) => i.name === "lesson_assignment_unique"), idx.map((i) => [i.name, !!i.unique]));
  const legacy = await col.findOne({ title: "Legacy quiz" });
  check("migration: legacy assessment marked as a module assessment", legacy?.kind === "module" && legacy?.lessonId === null, legacy);
}
const admin = client();
await admin.login("Moocs@admin", "Admin@123");
async function newStudent(tag: string) {
  const s = client();
  const r = await s.post("/registrations", { fullName: `Flow ${tag}`, email: `flow-${tag}@student.io`, password: "Passw0rd!", mobileNumber: "9998887777", schoolName: "Flow School" });
  if (r.status !== 201) throw new Error(`register failed ${JSON.stringify(r.json)}`);
  return s;
}
const anon = client();

// ── Content: M1 = L1 [T1 text, T2 discussion(required)] + assignment A1, L2 [T3] + assessment
//            M2 = L3 [T4] + assessment
const SLUG = "flow-course";
const courseId = (await admin.post("/admin/courses", { title: "Flow Course", slug: SLUG })).json.data.id;
const m1 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M1" })).json.data.id;
const m2 = (await admin.post(`/admin/courses/${courseId}/modules`, { title: "M2" })).json.data.id;
const lesson = async (m: string, t: string) => (await admin.post(`/admin/courses/modules/${m}/lessons`, { title: t })).json.data.id;
const L1 = await lesson(m1, "L1");
const L2 = await lesson(m1, "L2");
const L3 = await lesson(m2, "L3");
const topic = async (l: string, body: Record<string, unknown>) => (await admin.post(`/admin/courses/lessons/${l}/topics`, { contentType: "rich_text", ...body }));
const T1 = (await topic(L1, { title: "T1", content: "Hello **world**", estimatedDurationMinutes: 5 })).json.data.id;
const t2 = await topic(L1, { title: "T2 Discuss", contentType: "discussion", description: "Talk", discussion: { prompt: "What surprised you?", instructions: "Be kind", questions: ["Why?", " "], required: true } });
const T2 = t2.json.data.id;
check("discussion topic created with its config", t2.status === 201 && t2.json.data.contentType === "discussion" && t2.json.data.discussion.required === true && JSON.stringify(t2.json.data.discussion.questions) === JSON.stringify(["Why?"]), t2.json?.data?.discussion);
const T3 = (await topic(L2, { title: "T3", content: "three", videoUrl: "https://www.youtube.com/watch?v=abc", documentUrl: "/api/uploads/notes.pdf" })).json.data.id;
const T4 = (await topic(L3, { title: "T4", content: "four" })).json.data.id;

// ── Admin: lesson assignment CRUD + unified config ────────────────────────────
const a1r = await admin.post("/admin/assessments", { lessonId: L1, title: "L1 assignment", instructions: "Answer briefly." });
const A1 = a1r.json?.data?.id;
check("create lesson assignment → 201, kind lesson", a1r.status === 201 && a1r.json.data.kind === "lesson" && a1r.json.data.lessonId === L1 && a1r.json.data.moduleId === m1, a1r.json);
check("assignments are non-graded by default", a1r.json?.data?.isGraded === false && a1r.json?.data?.isRequired === true);
check("second assignment on the same lesson → 409", (await admin.post("/admin/assessments", { lessonId: L1, title: "dup" })).status === 409);
check("moduleId AND lessonId together → 400", (await admin.post("/admin/assessments", { lessonId: L2, moduleId: m1, title: "x" })).status === 400);
check("publish assignment without questions → 409", (await admin.post(`/admin/assessments/${A1}/publish`)).status === 409);
await admin.post(`/admin/assessments/${A1}/questions`, { type: "reflection", question: "Reflect.", marks: 2 });
await admin.post(`/admin/assessments/${A1}/questions`, READY_QUESTION);
check("publish assignment with questions → 200", (await admin.post(`/admin/assessments/${A1}/publish`)).status === 200);
{
  const bad = await admin.patch(`/admin/assessments/${A1}`, { availableFrom: "2030-01-02T00:00:00Z", availableUntil: "2030-01-01T00:00:00Z" });
  check("availability window must be ordered → 400", bad.status === 400);
  const cfg = await admin.patch(`/admin/assessments/${A1}`, { maxAttempts: 2, shuffleQuestions: true, timeLimitMinutes: 0, passingScore: 70 });
  check("unified config PATCH (attempts, shuffle, passing score)", cfg.status === 200 && cfg.json.data.maxAttempts === 2 && cfg.json.data.shuffleQuestions === true && cfg.json.data.passingScore === 70, cfg.json?.data);
}
const Q1 = await publishModule(admin, m1); // module assessment alongside the lesson assignment
check("module assessment coexists with a lesson assignment (index migration)", typeof Q1 === "string" && Q1 !== A1);
const Q2 = await publishModule(admin, m2);
await admin.post(`/admin/courses/${courseId}/publish`);
{
  const lessonGet = await admin.get(`/admin/assessments/lesson/${L1}`);
  check("admin GET lesson assignment", lessonGet.json?.data?.assessment?.id === A1 && lessonGet.json?.data?.questions?.length === 2);
  const modGet = await admin.get(`/admin/assessments/module/${m1}`);
  check("admin GET module assessment is not the lesson assignment", modGet.json?.data?.assessment?.id === Q1);
}

// ── Course tree: assignments listed; learners get no content ──────────────────
const student = await newStudent("a");
{
  const t = (await student.get(`/courses/${SLUG}`)).json?.data;
  const lessons = t?.modules?.flatMap((m: any) => m.lessons) ?? [];
  const topics = lessons.flatMap((l: any) => l.topics);
  check("tree: L1 carries its assignment summary", lessons.find((l: any) => l.id === L1)?.assignment?.id === A1);
  check("learner tree has no topic text/media/discussion text", topics.every((x: any) => !x.content && !x.videoUrl && !x.documentUrl && !x.discussion.prompt), topics.map((x: any) => [x.title, x.content, x.videoUrl]));
  check("learner tree keeps hasVideo", topics.find((x: any) => x.id === T3)?.hasVideo === true);
  const staff = (await admin.get(`/courses/${SLUG}`)).json?.data;
  check("staff tree keeps content", staff?.modules?.[0]?.lessons?.[0]?.topics?.[0]?.content === "Hello **world**");
}
check("anonymous: non-preview topic → 401", (await anon.get(`/courses/${SLUG}/topics/${T1}`)).status === 401);

// ── Sequence: T1 → T2 (discussion) → A1 → T3 → Q1 → M2 ─────────────────────────
const cp = (p: string, b?: unknown) => student.post(`/progress/${courseId}${p}`, b);
check("first topic open", (await student.get(`/courses/${SLUG}/topics/${T1}`)).status === 200);
{
  const r = await student.get(`/courses/${SLUG}/topics/${T2}`);
  check("next topic locked → 403 (direct API)", r.status === 403, r.status);
  check("completing a locked topic → 409", (await cp(`/topics/${T2}/complete`)).status === 409);
  check("recording a visit to a locked topic → 403", (await cp(`/visit`, { topicId: T2 })).status === 403);
}
await cp(`/topics/${T1}/complete`);
let threadId = "";
{
  const r = await student.get(`/courses/${SLUG}/topics/${T2}`);
  threadId = r.json?.data?.discussionThreadId;
  check("discussion topic opens with its forum thread", r.status === 200 && !!threadId && r.json.data.topic.discussion.prompt === "What surprised you?", r.json?.data);
  const thread = (await student.get(`/forum/threads/${threadId}`)).json?.data?.thread;
  check("thread is in the existing forum (title/prompt synced)", thread?.title === "T2 Discuss" && thread?.body === "What surprised you?" && thread?.topicId === T2, thread);
  const early = await cp(`/topics/${T2}/complete`);
  check("required discussion: complete before posting → 409", early.status === 409 && /discussion/i.test(early.json?.error?.message ?? ""), early.json);
  check("student posts in the discussion", (await student.post(`/forum/threads/${threadId}/replies`, { body: "AI is everywhere" })).status === 200);
  check("required discussion: complete after posting → 200", (await cp(`/topics/${T2}/complete`)).status === 200);
}
{
  const other = await newStudent("b");
  const r = await other.post(`/forum/threads/${threadId}/replies`, { body: "skip ahead" });
  check("posting in a discussion that is still locked → 403", r.status === 403, r.status);
}
check("T3 locked until the lesson assignment is done → 403", (await student.get(`/courses/${SLUG}/topics/${T3}`)).status === 403);
check("module assessment locked before the module's lessons → 403", (await student.post(`/assessments/${Q1}/start`)).status === 403);
{
  const view = await student.get(`/assessments/${A1}`);
  check("assignment open: untimed → questions visible, state present", view.status === 200 && view.json.data.questions.length === 2 && view.json.data.state.attemptsRemaining === 2, view.json?.data?.state);
  const ids = view.json.data.questions.map((q: any) => q.id);
  const sub = await student.post(`/assessments/${A1}/attempt`, { answers: ids.map((id: string) => ({ questionId: id, answer: "" })) });
  check("non-graded assignment: submitting (even blank) completes it", sub.status === 201 && sub.json.data.attempt.passed === true, sub.json?.data?.attempt);
  const p = (await student.get(`/progress/${courseId}`)).json?.data;
  check("progress: next item is T3 after the assignment", p?.nextItem?.id === T3 && p?.nextItem?.kind === "topic", p?.nextItem);
  await student.post(`/assessments/${A1}/attempt`, { answers: [] });
  const third = await student.post(`/assessments/${A1}/attempt`, { answers: [] });
  check("attempt limit (2) enforced → 409", third.status === 409, third.json);
}
check("T3 unlocked after the assignment", (await student.get(`/courses/${SLUG}/topics/${T3}`)).status === 200);

// Downloads (T3: YouTube video, local document, text).
{
  const t1Text = await student.get(`/courses/${SLUG}/topics/${T1}/download?part=text`);
  check("downloads are allowed by default (new topic)", t1Text.status === 200 && /attachment/.test(t1Text.headers.get("content-disposition") ?? ""), t1Text.status);
  await admin.patch(`/admin/courses/topics/${T3}`, { allowDownload: false });
  check("download switched off by the admin → 403", (await student.get(`/courses/${SLUG}/topics/${T3}/download?part=text`)).status === 403);
  const staffText = await admin.get(`/courses/${SLUG}/topics/${T3}/download?part=text`);
  check("staff can always download", staffText.status === 200 && /attachment/.test(staffText.headers.get("content-disposition") ?? ""), staffText.status);
  await admin.patch(`/admin/courses/topics/${T3}`, { allowDownload: true });
  const text = await student.get(`/courses/${SLUG}/topics/${T3}/download?part=text`);
  check("allowed: text downloads as a markdown attachment", text.status === 200 && text.text.includes("three") && /filename="t3\.md"/.test(text.headers.get("content-disposition") ?? ""), text.headers.get("content-disposition"));
  const doc = await student.get(`/courses/${SLUG}/topics/${T3}/download?part=document`);
  check("allowed: local document → redirect to the uploads route with ?download", doc.status === 302 && /^\/api\/uploads\/notes\.pdf\?download=t3\.pdf$/.test(doc.headers.get("location") ?? ""), doc.headers.get("location"));
  check("external video (YouTube) can't be downloaded → 409", (await student.get(`/courses/${SLUG}/topics/${T3}/download?part=video`)).status === 409);
  check("missing part → 404", (await student.get(`/courses/${SLUG}/topics/${T3}/download?part=audio`)).status === 404);
  check("download of a locked topic → 403", (await student.get(`/courses/${SLUG}/topics/${T4}/download?part=text`)).status === 403);
}

await cp(`/topics/${T3}/complete`);
check("Module 2 still locked (assessment not passed) → 403", (await student.get(`/courses/${SLUG}/topics/${T4}`)).status === 403);
{
  const locked = await student.get(`/courses/${SLUG}/topics/${T4}`);
  check("lock message names the previous module", /Module 1/.test(locked.json?.error?.message ?? ""), locked.json);
}
{
  const view = await student.get(`/assessments/${Q1}`);
  const q = view.json.data.questions[0];
  const fail1 = await student.post(`/assessments/${Q1}/attempt`, { answers: [{ questionId: q.id, answer: "No" }] });
  check("graded module assessment: wrong answer fails", fail1.status === 201 && fail1.json.data.attempt.passed === false);
  check("failed assessment keeps Module 2 locked", (await student.get(`/courses/${SLUG}/topics/${T4}`)).status === 403);
  await student.post(`/assessments/${Q1}/attempt`, { answers: [{ questionId: q.id, answer: "Yes" }] });
  const p = (await student.get(`/progress/${courseId}`)).json?.data;
  check("Module 1 complete (topics + assignment + assessment)", p?.progress?.completedModules?.includes(m1), p?.progress?.completedModules);
}
check("Module 2 unlocked after Module 1", (await student.get(`/courses/${SLUG}/topics/${T4}`)).status === 200);
await cp(`/topics/${T4}/complete`);

// ── Timed assessment (Module 2) ──────────────────────────────────────────────
await admin.patch(`/admin/courses/modules/${m2}`, { isPublished: false });
await admin.post(`/admin/assessments/${Q2}/questions`, { type: "mcq", question: "2+2?", options: ["3", "4", "5"], correctAnswer: "4", marks: 1 });
await admin.patch(`/admin/assessments/${Q2}`, { timeLimitMinutes: 1, shuffleOptions: true });
await admin.patch(`/admin/courses/modules/${m2}`, { isPublished: true });
{
  const view = await student.get(`/assessments/${Q2}`);
  check("timed: questions hidden until the attempt starts", view.status === 200 && view.json.data.questions.length === 0 && view.json.data.assessment.timeLimitMinutes === 1, view.json?.data);
  check("timed: submit without starting → 409", (await student.post(`/assessments/${Q2}/attempt`, { answers: [] })).status === 409);
  const s1 = await student.post(`/assessments/${Q2}/start`);
  const att = s1.json?.data?.state?.active;
  const left = Date.parse(att?.deadline) - Date.parse(s1.json?.data?.state?.serverNow);
  check("start: server deadline ≈ +60 s", s1.status === 201 && left > 55_000 && left <= 60_000, { left, att });
  check("start: questions revealed", s1.json.data.questions.length === 2);
  const s2 = await student.post(`/assessments/${Q2}/start`);
  check("resume after refresh: same attempt and deadline", s2.json?.data?.state?.active?.id === att.id && s2.json.data.state.active.deadline === att.deadline);
  const mcq = s1.json.data.questions.find((q: any) => q.options.includes("4"));
  const yes = s1.json.data.questions.find((q: any) => q.options.includes("Yes"));
  const opts2 = s2.json.data.questions.find((q: any) => q.id === mcq.id).options;
  check("shuffled option order is fixed for the attempt", JSON.stringify(opts2) === JSON.stringify(mcq.options), { a: mcq.options, b: opts2 });
  const draft = [{ questionId: mcq.id, answer: "4" }, { questionId: yes.id, answer: "Yes" }];
  const save = await student.put(`/assessments/${Q2}/attempts/${att.id}`, { answers: draft });
  check("autosave draft answers", save.status === 200 && save.json.data.deadline === att.deadline, save.json);
  const again = await student.get(`/assessments/${Q2}`);
  check("reload shows the saved answers", JSON.stringify(again.json?.data?.state?.active?.answers) === JSON.stringify(draft), again.json?.data?.state?.active);
  await expire(att.id);
  const late = await student.post(`/assessments/${Q2}/attempt`, { answers: [{ questionId: mcq.id, answer: "3" }] });
  check("late submit refused → 409, saved answers submitted instead", late.status === 409 && late.json?.data?.attempt?.autoSubmitted === true && late.json.data.attempt.score === 100, late.json);
  check("autosave after expiry → 409", (await student.put(`/assessments/${Q2}/attempts/${att.id}`, { answers: draft })).status === 409);
  const list = (await student.get(`/assessments/${Q2}/attempts`)).json?.data ?? [];
  check("attempt history shows the auto-submitted attempt", list.length === 1 && list[0].autoSubmitted === true && list[0].status === "submitted", list);
  const p = (await student.get(`/progress/${courseId}`)).json?.data;
  check("auto-submitted pass counts: course complete + certificate eligible", p?.progress?.completedModules?.includes(m2) && p?.progress?.certificateEligible === true, p?.progress);
}
{
  // A second student lets the timer run out and never comes back to the quiz:
  // the next progress read grades the saved answers.
  const s = await newStudent("c");
  for (const t of [T1]) await s.post(`/progress/${courseId}/topics/${t}/complete`);
  await s.post(`/forum/threads/${threadId}/replies`, { body: "hi" });
  await s.post(`/progress/${courseId}/topics/${T2}/complete`);
  await s.post(`/assessments/${A1}/attempt`, { answers: [] });
  await s.post(`/progress/${courseId}/topics/${T3}/complete`);
  await admin.patch(`/admin/courses/modules/${m1}`, { isPublished: false });
  await admin.patch(`/admin/assessments/${Q1}`, { timeLimitMinutes: 5 });
  await admin.patch(`/admin/courses/modules/${m1}`, { isPublished: true });
  const st = await s.post(`/assessments/${Q1}/start`);
  const q = st.json.data.questions[0];
  await s.put(`/assessments/${Q1}/attempts/${st.json.data.state.active.id}`, { answers: [{ questionId: q.id, answer: "Yes" }] });
  await expire(st.json.data.state.active.id);
  const p = (await s.get(`/progress/${courseId}`)).json?.data;
  check("expired attempt graded on the next progress read (sweep)", p?.progress?.assessmentScores?.some((a: any) => a.assessmentId === Q1 && a.passed), p?.progress?.assessmentScores);
  check("…which unlocks Module 2", (await s.get(`/courses/${SLUG}/topics/${T4}`)).status === 200);
}
{
  await admin.patch(`/admin/assessments/${Q2}`, { availableFrom: new Date(Date.now() + 86_400_000).toISOString() });
  const s = await newStudent("d");
  // Not yet unlocked for a new student, so check availability via the staff-free path: student A.
  const r = await student.post(`/assessments/${Q2}/start`);
  check("availability window: not open yet → 403", r.status === 403 && /not available/i.test(r.json?.error?.message ?? ""), r.json);
  void s;
}

console.log(`\nLEARNING FLOW CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("Failures:\n - " + failures.join("\n - "));
await db.close();
await mongo.stop();
process.exit(fail ? 1 : 0);
