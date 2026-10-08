// Verifies the course importer (server/seed/course-import.ts, CLI `npm run
// import:course`) against server/data/imports/demystifying-ai-five-week.json:
//  A. fresh import → every module/lesson/item/assignment/question/option/answer
//     key/mark/duration/attempt/weight/prompt/activity matches the JSON, in order;
//     re-run is a no-op (no duplicates); no orphans; incomplete content flagged;
//     student APIs expose no answer keys or admin-only fields; admin APIs do.
//  B. merge into a HAND-BUILT course (like the live one): existing topics/questions
//     untouched and matched (no duplicates, reworded questions recognised), new items
//     added as drafts in a published module, student progress unchanged.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { publishModule } from "./_fixtures.mts";

const PORT = 4124;
const BASE = `http://127.0.0.1:${PORT}/api`;
const JSON_FILE = path.join(process.cwd(), "server/data/imports/demystifying-ai-five-week.json");
const SRC = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ""}`); }
}
function client() {
  let cookie = "";
  async function req(method: string, p: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers["cookie"] = cookie;
    const res = await fetch(`${BASE}${p}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const sc of res.headers.getSetCookie?.() ?? []) if (sc.startsWith("afe_session=")) cookie = sc.split(";")[0];
    const text = await res.text();
    let json: any = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  }
  return { get: (p: string) => req("GET", p), post: (p: string, b?: unknown) => req("POST", p, b), patch: (p: string, b?: unknown) => req("PATCH", p, b), login: (l: string, pw: string) => req("POST", "/auth/login", { login: l, password: pw }) };
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
await (await import("./_server.mts")).startServer();
if (!(await waitForHealth())) { console.error("not healthy"); process.exit(1); }
const db = new MongoClient(URI);
await db.connect();
const col = (n: string) => db.db().collection(n);

/** Run the real CLI against the in-memory database. */
function runImport(slug: string, key: string): { ok: boolean; out: string; created: Record<string, number> } {
  const r = spawnSync(process.execPath, ["--import", "tsx", "server/seed/import-course.ts", "--file", JSON_FILE, "--course-slug", slug, "--course-key", key], {
    env: { ...process.env, MONGODB_URI: URI },
    encoding: "utf8",
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const m = /Created: (\{.*\})/.exec(out);
  return { ok: r.status === 0, out, created: m ? JSON.parse(m[1]) : {} };
}

const admin = client();
await admin.login("Moocs@admin", "Admin@123");
const ADMIN_KEYS = ["importKey", "contentStatus", "adminNote", "gradeCategory"];
/** Paths where admin-only keys or answer keys appear in a JSON payload. */
function leaks(obj: unknown, keys: string[], at = "$"): string[] {
  if (!obj || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (keys.includes(k)) out.push(`${at}.${k}`);
    out.push(...leaks(v, keys, `${at}.${k}`));
  }
  return out;
}
const sortedLetters = (o: Record<string, string>) => Object.keys(o).sort();

// ════════════════════════ A. Fresh import ════════════════════════
console.log("[Course import checks — A: fresh course]");
const run1 = runImport("five-week-import", "five-week-import");
check("CLI import exits 0", run1.ok, run1.out.slice(-600));
const course = await col("courses").findOne({ importKey: "five-week-import" });
check("1. course created (draft) with the source title", !!course && course.title === SRC.course.title && course.status === "draft", course && { t: course.title, s: course.status });
const cid = String(course?._id);
check("11. assessment weights stored exactly (40/20/30/10)", JSON.stringify(course?.gradingWeights) === JSON.stringify(Object.entries(SRC.course.assessment_weights).map(([category, w]) => ({ category, weight: Number(String(w).replace("%", "")) }))), course?.gradingWeights);
check("course admin note keeps source metadata + inconsistency notes", /Target group: Classes 9–12/.test(course?.adminNote ?? "") && /six weeks/.test(course?.adminNote ?? ""));

const modules = await col("modules").find({ courseId: cid }).sort({ order: 1 }).toArray();
check("2. module count = 5", modules.length === SRC.modules.length, modules.length);
check("3. module order + titles = source", JSON.stringify(modules.map((m) => m.title)) === JSON.stringify(SRC.modules.map((m: any) => m.title)), modules.map((m) => m.title));
check("modules carry their learning outcome as an objective", modules.every((m, i) => m.learningObjectives?.[0] === SRC.modules[i].learning_outcome));
check("imported modules are unpublished", modules.every((m) => m.isPublished === false));

const allTopics = await col("topics").find({ courseId: cid }).toArray();
const allAssess = await col("assessments").find({ courseId: cid }).toArray();
const allQuestions = await col("questions").find({ courseId: cid }).toArray();
let orderOk = true;
const orderDetail: unknown[] = [];
for (const sm of SRC.modules) {
  const mod = modules.find((m) => m.importKey === sm.id)!;
  const lessons = await col("lessons").find({ moduleId: String(mod._id) }).sort({ order: 1 }).toArray();
  if (JSON.stringify(lessons.map((l) => l.title)) !== JSON.stringify(sm.lessons.map((l: any) => l.title))) { orderOk = false; orderDetail.push({ m: sm.id, lessons: lessons.map((l) => l.title) }); }
  for (const sl of sm.lessons) {
    const lesson = lessons.find((l) => l.importKey === sl.id)!;
    // Expected items in source order (the module's graded quiz listed as an item is the module assessment).
    const expected = sl.content_items
      .map((ci: string, i: number) => { const m = /^(\d+(?:\.\d+)+)\s+/.exec(ci); return m ? m[1] : `${sl.id}.${i + 1}`; })
      .filter((key: string, i: number) => !(!sm.assignments.some((a: any) => a.id === key) && /\(graded\)/i.test(sl.content_items[i])));
    const rows = [
      ...allTopics.filter((t) => t.lessonId === String(lesson._id)).map((t) => ({ key: t.importKey, pos: t.order, tie: 0 })),
      ...allAssess.filter((a) => a.lessonId === String(lesson._id)).map((a) => ({ key: a.importKey, pos: a.order ?? Infinity, tie: 1 })),
    ].sort((x, y) => x.pos - y.pos || x.tie - y.tie);
    const got = rows.map((r) => r.key).filter((k) => expected.includes(k));
    if (JSON.stringify(got) !== JSON.stringify(expected)) { orderOk = false; orderDetail.push({ lesson: sl.id, expected, got }); }
  }
}
check("4. lesson order + item order inside each lesson = source order", orderOk, orderDetail);

const lessonAssignments = allAssess.filter((a) => a.kind === "lesson");
const moduleAssessments = allAssess.filter((a) => a.kind === "module");
check("5. lesson assignments: 1.1.6, 1.2.7, 2.1.6, 2.2.14, 3.1.6, 3.2.9, 4.1.5, 4.2.5, 4.2.13, self-reflection", JSON.stringify(lessonAssignments.map((a) => a.importKey).sort()) === JSON.stringify(["1.1.6", "1.2.7", "2.1.6", "2.2.14", "3.1.6", "3.2.9", "4.1.5", "4.2.13", "4.2.5", "self-reflection"]), lessonAssignments.map((a) => a.importKey));
check("5. module assessments: week-1…4-graded + course-quiz", JSON.stringify(moduleAssessments.map((a) => a.importKey).sort()) === JSON.stringify(["course-quiz", "week-1-graded", "week-2-graded", "week-3-graded", "week-4-graded"]), moduleAssessments.map((a) => a.importKey));
check("lesson 4.2 holds TWO assignments (several per lesson)", lessonAssignments.filter((a) => a.importKey === "4.2.5" || a.importKey === "4.2.13").every((a, _, arr) => a.lessonId === arr[0].lessonId));
check("all imported assessments are unpublished", allAssess.every((a) => a.isPublished === false));

// 6–10. MCQs, options, answer keys, durations, marks, attempts
let mcqOk = true;
const mcqDetail: unknown[] = [];
let expectedQ = 0;
for (const sm of SRC.modules) for (const sa of sm.assignments) {
  if (!sa.questions) continue;
  const a = allAssess.find((x) => x.importKey === sa.id)!;
  const qs = allQuestions.filter((q) => q.assessmentId === String(a._id)).sort((x, y) => x.order - y.order);
  expectedQ += sa.questions.length;
  if (qs.length !== sa.questions.length) { mcqOk = false; mcqDetail.push({ id: sa.id, n: qs.length }); continue; }
  sa.questions.forEach((sq: any, i: number) => {
    const q = qs[i];
    const opts = sortedLetters(sq.options).map((l) => sq.options[l]);
    const key = sq.correct_answer ? sq.options[sq.correct_answer] : "";
    const marks = sa.marks ? sa.marks / sa.questions.length : 1;
    if (q.question !== sq.question || JSON.stringify(q.options) !== JSON.stringify(opts) || q.correctAnswer !== key || q.marks !== marks || q.importKey !== `${sa.id}#${i + 1}` || q.type !== "mcq") {
      mcqOk = false; mcqDetail.push({ id: `${sa.id}#${i + 1}`, q: q.question === sq.question, opts: JSON.stringify(q.options) === JSON.stringify(opts), key: [q.correctAnswer, key], marks: [q.marks, marks] });
    }
  });
}
check("6. MCQ count = source (65)", allQuestions.length === expectedQ && expectedQ === 65, { got: allQuestions.length, expectedQ });
check("7–8. question wording, options (A–D order) and answer keys exactly as the source", mcqOk, mcqDetail.slice(0, 5));
check("answer key absent in the source (1.2.7) stays empty — not invented", allQuestions.filter((q) => String(q.importKey).startsWith("1.2.7#")).every((q) => q.correctAnswer === ""));
const byKey = (k: string) => allAssess.find((a) => a.importKey === k)!;
check("9. durations imported as estimated minutes (e.g. 1.1.6 = 10, week-2-graded = 30)", byKey("1.1.6").estimatedDurationMinutes === 10 && byKey("week-2-graded").estimatedDurationMinutes === 30 && byKey("4.2.5").estimatedDurationMinutes === 15);
check("10. marks: graded weekly quizzes 10 marks over 10 questions", ["week-1-graded", "week-2-graded", "week-3-graded"].every((k) => allQuestions.filter((q) => q.assessmentId === String(byKey(k)._id)).reduce((n, q) => n + q.marks, 0) === 10));
check("attempts: week-3-graded = 2; 'unlimited' = 0 (unlimited)", byKey("week-3-graded").maxAttempts === 2 && byKey("1.1.6").maxAttempts === 0);
check("graded flags: weekly graded quizzes graded, practice quizzes not graded", ["week-1-graded", "week-4-graded", "course-quiz"].every((k) => byKey(k).isGraded === true) && ["1.1.6", "2.2.14", "4.2.5"].every((k) => byKey(k).isGraded === false));
check("grading categories tagged (weekly quizzes / applied / project / discussion)", byKey("week-2-graded").gradeCategory === "Weekly quizzes, Weeks 1–4" && allTopics.find((t) => t.importKey === "week-1-applied")?.gradeCategory === "Applied activities, Weeks 1–4" && allTopics.find((t) => t.importKey === "final-project")?.gradeCategory === "Final project and explanation" && allTopics.find((t) => t.importKey === "peer-feedback")?.gradeCategory === "Discussion participation and peer feedback");

// 12. discussions
const discussions = allTopics.filter((t) => t.contentType === "discussion");
const srcDiscussions = SRC.modules.flatMap((m: any) => m.assignments.filter((a: any) => a.type === "discussion"));
check("12. discussion topics = source discussions (5) with exact prompts", discussions.length === srcDiscussions.length && srcDiscussions.every((sd: any) => discussions.some((d) => d.importKey === sd.id && d.discussion.prompt === sd.prompt && d.title === sd.title)), discussions.map((d) => d.importKey));
check("discussion requirements imported as instructions", discussions.find((d) => d.importKey === "1.1.5")?.discussion?.instructions === srcDiscussions.find((d: any) => d.id === "1.1.5").requirements);
check("facilitator notes are admin-only (adminNote), not in the prompt", /Situations A and B are fixed-rule automation/.test(discussions.find((d) => d.importKey === "1.1.5")?.adminNote ?? "") && !/Situation C is machine learning/.test(JSON.stringify(discussions.find((d) => d.importKey === "1.1.5")?.discussion)));
const threads = await col("forumthreads").find({ courseId: cid }).toArray();
check("each discussion has its forum thread", discussions.every((d) => threads.some((t) => t.topicId === String(d._id))), threads.length);

// 13. activities
const activities = allTopics.filter((t) => t.contentType === "activity");
const srcActivities = SRC.modules.flatMap((m: any) => m.assignments.filter((a: any) => ["practical_scenario", "guided_activity", "applied_activity", "project_proposal", "project"].includes(a.type)));
check("13. practical/guided/applied activities + final project = 7 activity topics with exact requirements", activities.length === srcActivities.length && srcActivities.every((sa: any) => activities.some((t) => t.importKey === sa.id && t.content === sa.requirements && t.title === sa.title)), activities.map((t) => t.importKey));
check("activity durations kept (2.2.5 = 45, 3.2.4 = 90)", activities.find((t) => t.importKey === "2.2.5")?.estimatedDurationMinutes === 45 && activities.find((t) => t.importKey === "3.2.4")?.estimatedDurationMinutes === 90);

// Missing content
const needs = [...allTopics, ...allAssess].filter((x) => x.contentStatus === "needs_content").map((x) => x.importKey);
check("missing question banks flagged (4.2.5, 4.2.13, week-4-graded, course-quiz, self-reflection) + 1.2.7 answer key", ["4.2.5", "4.2.13", "week-4-graded", "course-quiz", "self-reflection", "1.2.7"].every((k) => needs.includes(k)), needs);
check("shell quizzes have NO invented questions", ["4.2.5", "4.2.13", "week-4-graded", "course-quiz", "self-reflection"].every((k) => allQuestions.filter((q) => q.assessmentId === String(byKey(k)._id)).length === 0));
check("graded project/applied activities flagged as needing a submission feature", ["final-project", "week-1-applied", "week-3-applied"].every((k) => allTopics.find((t) => t.importKey === k)?.contentStatus === "needs_content"));
check("title-only content items are draft shells (hidden from students)", allTopics.filter((t) => t.contentType !== "discussion" && t.contentType !== "activity").every((t) => t.contentStatus === "needs_content" && t.isPublished === false));

// 14–17. Idempotency + integrity
const counts = async () => Object.fromEntries(await Promise.all(["modules", "lessons", "topics", "assessments", "questions", "forumthreads"].map(async (c) => [c, await col(c).countDocuments({ courseId: cid })])));
const before = await counts();
const run2 = runImport("five-week-import", "five-week-import");
check("14. re-run: exit 0 and NOTHING created", run2.ok && Object.keys(run2.created).length === 0, run2.created);
check("14. re-run: record counts unchanged (no duplicates)", JSON.stringify(await counts()) === JSON.stringify(before), { before, after: await counts() });
for (const c of ["modules", "lessons", "topics", "assessments", "questions"]) {
  const dup = await col(c).aggregate([{ $match: { courseId: cid, importKey: { $type: "string" } } }, { $group: { _id: "$importKey", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]).toArray();
  check(`14. no duplicate importKeys in ${c}`, dup.length === 0, dup);
}
const moduleIds = new Set(modules.map((m) => String(m._id)));
const lessonIds = new Set((await col("lessons").find({ courseId: cid }).toArray()).map((l) => String(l._id)));
const assessIds = new Set(allAssess.map((a) => String(a._id)));
check("15–17. no orphaned lessons/topics/assignments/questions", [...lessonIds].length > 0 &&
  (await col("lessons").find({ courseId: cid }).toArray()).every((l) => moduleIds.has(l.moduleId)) &&
  allTopics.every((t) => lessonIds.has(t.lessonId) && moduleIds.has(t.moduleId)) &&
  allAssess.every((a) => moduleIds.has(a.moduleId) && (a.kind !== "lesson" || lessonIds.has(a.lessonId))) &&
  allQuestions.every((q) => assessIds.has(q.assessmentId)));

// 19. Admin API
const adminTree = (await admin.get(`/admin/courses/${cid}`)).json?.data;
check("19. admin tree: 5 modules, ordered lesson assignments, needs-content counts", adminTree?.modules?.length === 5 && adminTree.modules[3].needsContent > 0 && adminTree.modules[3].lessons[1].assignments.length === 2, adminTree?.modules?.map((m: any) => m.needsContent));
const adminQuiz = (await admin.get(`/admin/assessments/${byKey("1.1.6")._id}`)).json?.data;
check("19. admin sees MCQ answer keys", adminQuiz?.questions?.[0]?.correctAnswer === SRC.modules[0].assignments[1].questions[0].options.B);
const lessonBundle = (await admin.get(`/admin/assessments/lesson/${byKey("4.2.5").lessonId}`)).json?.data;
check("19. admin lesson endpoint lists both 4.2 assignments in order", JSON.stringify(lessonBundle?.assignments?.map((x: any) => x.assessment.importKey)) === JSON.stringify(["4.2.5", "4.2.13"]), lessonBundle?.assignments?.map((x: any) => x.assessment.importKey));
const fill = await admin.patch(`/admin/assessments/questions/${allQuestions.find((q) => q.importKey === "1.2.7#1")!._id}`, { correctAnswer: "Colour, weight, and texture are the features; the fruit name is the label." });
check("admin can add a missing answer key later", fill.status === 200 && fill.json?.data?.correctAnswer.startsWith("Colour"));

// 18 + student experience: publish Module 1 pieces and look as a student.
const m1 = modules[0];
await admin.patch(`/admin/courses/modules/${m1._id}`, { description: "Week 1." });
const t111 = allTopics.find((t) => t.importKey === "1.1.1")!;
await admin.patch(`/admin/courses/topics/${t111._id}`, { isPublished: true });
await admin.post(`/admin/assessments/${byKey("1.1.6")._id}/publish`);
await admin.patch(`/admin/courses/modules/${m1._id}`, { isPublished: true });
await admin.post(`/admin/courses/${cid}/publish`);
const student = client();
await student.post("/registrations", { fullName: "Import Learner", email: "import@student.io", password: "Passw0rd!", mobileNumber: "9998887777", schoolName: "Import School" });
const pubTree = await student.get(`/courses/${course!.slug}`);
const sTree = pubTree.json?.data;
check("20. student sees the course: Module 1 only (others unpublished)", pubTree.status === 200 && sTree?.modules?.length === 1, sTree?.modules?.length);
const sTopics = sTree?.modules?.[0]?.lessons?.flatMap((l: any) => l.topics) ?? [];
check("20. student tree: draft shells hidden, published topic + discussion/activities shown", sTopics.some((t: any) => t.id === String(t111._id)) && !sTopics.some((t: any) => t.title === "From Rules to Learning: A brief Journal of AI"), sTopics.map((t: any) => t.title));
check("20. student tree: only the published lesson assignment", JSON.stringify(sTree?.modules?.[0]?.lessons?.flatMap((l: any) => l.assignments.map((a: any) => a.title))) === JSON.stringify(["Spot the AI"]));
check("Phase 9: no admin-only fields anywhere in the student course tree", leaks(sTree, ADMIN_KEYS).length === 0, leaks(sTree, ADMIN_KEYS).slice(0, 5));
check("draft topic by direct URL → not found for students", (await student.get(`/courses/${course!.slug}/topics/${allTopics.find((t) => t.importKey === "1.1.2")!._id}`)).status === 404);
// Complete what comes before quiz 1.1.6 in order (1.1.1, then the 1.1.5 discussion).
await student.post(`/progress/${cid}/topics/${t111._id}/complete`);
await student.post(`/progress/${cid}/topics/${allTopics.find((t) => t.importKey === "1.1.5")!._id}/complete`);
const sq = await student.get(`/assessments/${byKey("1.1.6")._id}`);
check("18. student assessment view: no correct answers / explanations / admin fields", sq.status === 200 && sq.json?.data?.questions?.length === 5 && leaks(sq.json?.data, ["correctAnswer", "explanation", ...ADMIN_KEYS]).length === 0, leaks(sq.json?.data, ["correctAnswer", "explanation", ...ADMIN_KEYS]));
const list = await student.get("/courses");
check("student course list exposes no admin notes", leaks(list.json?.data, ["adminNote", "importKey"]).length === 0);
const attempt = await student.post(`/assessments/${byKey("1.1.6")._id}/attempt`, { answers: sq.json.data.questions.map((q: any) => ({ questionId: q.id, answer: q.options[0] })) });
check("student can attempt + submit an imported MCQ quiz (results per platform rules)", attempt.status === 201 && typeof attempt.json?.data?.attempt?.score === "number");

// ════════════════════════ B. Merge into a hand-built course ════════════════════════
console.log("[Course import checks — B: merge into a hand-built course]");
const hb = (await admin.post("/admin/courses", { title: "Hand Built", slug: "hand-built" })).json.data.id;
const hm = (await admin.post(`/admin/courses/${hb}/modules`, { title: "Week 1: Understanding AI and How It Learns" })).json.data.id;
const hl = (await admin.post(`/admin/courses/modules/${hm}/lessons`, { title: "Lesson 1: Undestanding AI" })).json.data.id;
const mk = async (title: string, extra: Record<string, unknown> = {}) => (await admin.post(`/admin/courses/lessons/${hl}/topics`, { title, contentType: "video", videoUrl: `https://cdn.example.com/${encodeURIComponent(title)}.mp4`, ...extra })).json.data.id;
const hWhat = await mk("What is AI");
const hRules = await mk("From Rules to Learning: A brief journal AI");
const hAround = await mk("AI Around Us");
const hReimag = await mk("Essential Reading: Reimagining AI in Everyday Life", { contentType: "rich_text", content: "Hand-written reading." });
const hAssign = (await admin.post("/admin/assessments", { lessonId: hl, title: "Lesson assignment" })).json.data.id;
await admin.post(`/admin/assessments/${hAssign}/questions`, { type: "mcq", question: "Does automatic mean AI? A school bell rings at fixed times entered by an administrator. Nothing in the description indicates that it learns, reasons, or makes predictions. Which statement is most appropriate?", options: ["x", "y"], correctAnswer: "y", marks: 1 });
await publishModule(admin, hm);
await admin.post(`/admin/courses/${hb}/publish`);
const learner = client();
await learner.post("/registrations", { fullName: "Merge Learner", email: "merge@student.io", password: "Passw0rd!", mobileNumber: "9998887777", schoolName: "Merge School" });
for (const t of [hWhat, hRules, hAround, hReimag]) await learner.post(`/progress/${hb}/topics/${t}/complete`);
const progBefore = (await learner.get(`/progress/${hb}`)).json?.data;
const topicsBefore = await col("topics").find({ courseId: hb }).toArray();
const qBefore = await col("questions").find({ assessmentId: hAssign }).toArray();

const merge = runImport("hand-built", "hand-built-merge");
check("merge import exits 0", merge.ok, merge.out.slice(-600));
const topicsAfter = await col("topics").find({ courseId: hb }).toArray();
check("existing topics untouched (title, media, text, order) and stamped with importKeys", topicsBefore.every((b) => { const a = topicsAfter.find((t) => String(t._id) === String(b._id))!; return a.title === b.title && a.videoUrl === b.videoUrl && a.content === b.content && a.order === b.order; }) && topicsAfter.find((t) => String(t._id) === hWhat)?.importKey === "1.1.1" && topicsAfter.find((t) => String(t._id) === hRules)?.importKey === "1.1.2");
check("no duplicate topics for matched items (What is AI ≡ What is Artificial Intelligence)", topicsAfter.filter((t) => t.lessonId === hl && /what is (ai|artificial intelligence)/i.test(t.title)).length === 1);
const newInLesson = topicsAfter.filter((t) => t.lessonId === hl && !topicsBefore.some((b) => String(b._id) === String(t._id)));
check("new items in a PUBLISHED module are drafts (1.1.5 discussion, 1.1.7 reading)", newInLesson.length >= 2 && newInLesson.every((t) => t.isPublished === false), newInLesson.map((t) => [t.importKey, t.isPublished]));
const adopted = await col("assessments").findOne({ _id: new (await import("mongodb")).ObjectId(hAssign) });
check("placeholder 'Lesson assignment' adopted as 1.1.6 and titled from the source", adopted?.importKey === "1.1.6" && adopted?.title === "Spot the AI");
const qAfter = await col("questions").find({ assessmentId: hAssign }).toArray();
check("reworded existing question recognised (kept, not duplicated): 1 existing + 4 added = 5", qAfter.length === 5 && qBefore.every((b) => qAfter.some((q) => String(q._id) === String(b._id) && q.question === b.question && q.correctAnswer === b.correctAnswer)), qAfter.length);
const progAfter = (await learner.get(`/progress/${hb}`)).json?.data;
check("student progress unchanged by the import", JSON.stringify(progBefore?.progress?.completedTopics) === JSON.stringify(progAfter?.progress?.completedTopics) && progBefore?.nextItem?.id === progAfter?.nextItem?.id && progBefore?.progress?.overallProgress === progAfter?.progress?.overallProgress, { before: progBefore?.nextItem, after: progAfter?.nextItem });
const merge2 = runImport("hand-built", "hand-built-merge");
check("merge re-run creates nothing", merge2.ok && Object.keys(merge2.created).length === 0, merge2.created);

console.log(`\nCOURSE IMPORT CHECKS: ${pass} passed, ${fail} failed`);
if (fail) console.log("Failures:\n - " + failures.join("\n - "));
await db.close();
await mongo.stop();
process.exit(fail ? 1 : 0);
