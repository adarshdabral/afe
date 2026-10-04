// Progress service (Progress Tracking). Persists per-(student,course) progress
// and derives module/course completion + certificate eligibility. Progress is
// tracked per TOPIC — the learning unit in Course → Module → Lesson → Topic. The
// sequence is every topic in module order → lesson order → topic order, and the
// sequential rule applies to it: topic N can only be completed once topic N-1 is.

import { Module } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { Topic } from "../models/Topic";
import { Progress, toProgress, type ProgressView } from "../models/Progress";
import { publishedAssessmentIds } from "./assessment.service";
import { issueCertificate } from "./certificate.service";
import { cachedContent } from "../cache/content-cache";

/** Auto-issue a certificate the moment progress becomes eligible (idempotent). */
async function maybeIssueCertificate(doc: { certificateEligible?: boolean; studentId: string; courseId: string }): Promise<void> {
  if (doc.certificateEligible !== true) return;
  try {
    await issueCertificate(doc.studentId, doc.courseId);
  } catch {
    /* non-fatal — issuance is retried on the next eligible progress update */
  }
}

interface Structure {
  moduleIds: string[];
  byModule: Map<string, string[]>; // moduleId → ordered topicIds
  sequence: string[]; // flat ordered topicIds (module → lesson → topic order)
}

/** The course's topic sequence — cached (content cache, invalidated on CMS writes). */
function courseStructure(courseId: string): Promise<Structure> {
  return cachedContent(`structure:${courseId}`, () => loadCourseStructure(courseId));
}

async function loadCourseStructure(courseId: string): Promise<Structure> {
  // Ids only — the sequence never needs topic bodies.
  const [modules, lessons, topics] = await Promise.all([
    Module.find({ courseId }).sort({ order: 1, createdAt: 1 }).select("_id").lean(),
    Lesson.find({ courseId }).sort({ order: 1, createdAt: 1 }).select("_id moduleId").lean(),
    Topic.find({ courseId }).sort({ order: 1, createdAt: 1 }).select("_id lessonId").lean(),
  ]);
  const topicsByLesson = new Map<string, string[]>();
  for (const t of topics) {
    if (!topicsByLesson.has(t.lessonId)) topicsByLesson.set(t.lessonId, []);
    topicsByLesson.get(t.lessonId)!.push(String(t._id));
  }
  const lessonsByModule = new Map<string, string[]>();
  for (const l of lessons) {
    if (!lessonsByModule.has(l.moduleId)) lessonsByModule.set(l.moduleId, []);
    lessonsByModule.get(l.moduleId)!.push(String(l._id));
  }
  const byModule = new Map<string, string[]>();
  const sequence: string[] = [];
  const moduleIds: string[] = [];
  for (const m of modules) {
    const mid = String(m._id);
    moduleIds.push(mid);
    const ids = (lessonsByModule.get(mid) ?? []).flatMap((lid) => topicsByLesson.get(lid) ?? []);
    byModule.set(mid, ids);
    sequence.push(...ids);
  }
  return { moduleIds, byModule, sequence };
}

/**
 * Atomic update of the student's progress doc, creating it on first access — one
 * round trip. Two first-ever requests racing to insert hit the unique
 * (studentId, courseId) index; the loser simply retries as an update.
 */
async function upsertProgress(studentId: string, courseId: string, update: Record<string, unknown> = {}) {
  const run = () =>
    Progress.findOneAndUpdate({ studentId, courseId }, { ...update, $setOnInsert: { studentId, courseId } }, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  try {
    return (await run())!;
  } catch (err) {
    if ((err as { code?: number })?.code !== 11000) throw err;
    return (await run())!;
  }
}

const getOrCreate = (studentId: string, courseId: string) => upsertProgress(studentId, courseId);

/** Recompute derived fields (modules complete, overall %, certificate) in place. */
async function recompute(
  doc: Awaited<ReturnType<typeof getOrCreate>>,
  struct: Structure,
  mandatory: string[],
): Promise<void> {
  const completed = new Set(doc.completedTopics ?? []);
  doc.completedModules = struct.moduleIds.filter((mid) => {
    const ts = struct.byModule.get(mid) ?? [];
    return ts.length > 0 && ts.every((t) => completed.has(t));
  });
  const total = struct.sequence.length;
  const done = struct.sequence.filter((t) => completed.has(t)).length;
  doc.overallProgress = total > 0 ? Math.round((done / total) * 100) : 0;

  const passed = new Set((doc.assessmentScores ?? []).filter((a) => a.passed).map((a) => a.assessmentId));
  const allAssessmentsPassed = mandatory.every((id) => passed.has(id));
  doc.certificateEligible = doc.overallProgress === 100 && allAssessmentsPassed;
}

export interface ProgressDetail {
  progress: ProgressView;
  totalTopics: number;
  /** First not-yet-completed topic the student may access (null = all done). */
  nextTopicId: string | null;
}

async function detail(
  doc: Awaited<ReturnType<typeof getOrCreate>>,
  struct: Structure,
): Promise<ProgressDetail> {
  const completed = new Set(doc.completedTopics ?? []);
  const nextTopicId = struct.sequence.find((t) => !completed.has(t)) ?? null;
  return { progress: toProgress(doc), totalTopics: struct.sequence.length, nextTopicId };
}

/** Read (creating an empty record if needed) — includes the next unlocked topic. */
export async function getProgress(studentId: string, courseId: string): Promise<ProgressDetail> {
  const [doc, struct] = await Promise.all([getOrCreate(studentId, courseId), courseStructure(courseId)]);
  return detail(doc, struct);
}

export type CompleteResult =
  | { ok: true; detail: ProgressDetail }
  | { ok: false; reason: "not_found" | "locked" };

/**
 * Mark a topic complete. Sequential rule: the immediately-preceding topic in the
 * flat course sequence must already be complete. Idempotent.
 */
export async function markTopicComplete(
  studentId: string,
  courseId: string,
  topicId: string,
): Promise<CompleteResult> {
  const [struct, doc, mandatory] = await Promise.all([
    courseStructure(courseId),
    getOrCreate(studentId, courseId),
    publishedAssessmentIds(courseId),
  ]);
  const idx = struct.sequence.indexOf(topicId);
  if (idx === -1) return { ok: false, reason: "not_found" };
  const completed = new Set(doc.completedTopics ?? []);
  if (idx > 0 && !completed.has(struct.sequence[idx - 1])) {
    return { ok: false, reason: "locked" };
  }
  if (!completed.has(topicId)) {
    doc.completedTopics = [...(doc.completedTopics ?? []), topicId];
  }
  doc.lastVisitedTopicId = topicId;
  await recompute(doc, struct, mandatory);
  await doc.save();
  await maybeIssueCertificate(doc);
  return { ok: true, detail: await detail(doc, struct) };
}

/** Merge an assessment result (keeps best score) and recompute completion. */
export async function applyAssessmentResult(
  studentId: string,
  courseId: string,
  result: { assessmentId: string; score: number; passed: boolean },
): Promise<ProgressDetail> {
  const [doc, struct, mandatory] = await Promise.all([
    getOrCreate(studentId, courseId),
    courseStructure(courseId),
    publishedAssessmentIds(courseId),
  ]);
  // Work on a plain array (avoids Mongoose subdocument-array typing) then set().
  const scores = (doc.assessmentScores ?? []).map((a) => ({
    assessmentId: a.assessmentId ?? "",
    score: a.score ?? 0,
    passed: a.passed === true,
  }));
  const existing = scores.find((a) => a.assessmentId === result.assessmentId);
  if (existing) {
    existing.score = Math.max(existing.score, result.score);
    existing.passed = existing.passed || result.passed;
  } else {
    scores.push({ ...result });
  }
  doc.set("assessmentScores", scores);
  await recompute(doc, struct, mandatory);
  await doc.save();
  await maybeIssueCertificate(doc);
  return detail(doc, struct);
}

export async function setLastVisited(
  studentId: string,
  courseId: string,
  topicId: string,
): Promise<ProgressDetail> {
  // One atomic write (creating the record if needed) alongside the structure read.
  const [doc, struct] = await Promise.all([
    upsertProgress(studentId, courseId, { $set: { lastVisitedTopicId: topicId } }),
    courseStructure(courseId),
  ]);
  return detail(doc, struct);
}

export async function addTimeSpent(
  studentId: string,
  courseId: string,
  minutes: number,
): Promise<ProgressDetail> {
  const [doc, struct] = await Promise.all([
    upsertProgress(studentId, courseId, { $inc: { timeSpentMinutes: Math.max(0, Math.round(minutes)) } }),
    courseStructure(courseId),
  ]);
  return detail(doc, struct);
}

/** All progress records for a student (dashboard). */
export async function listStudentProgress(studentId: string): Promise<ProgressView[]> {
  const docs = await Progress.find({ studentId }).sort({ updatedAt: -1 });
  return docs.map(toProgress);
}

/** Progress records for a course (teacher dashboard aggregates). */
export async function listCourseProgress(courseId: string): Promise<ProgressView[]> {
  const docs = await Progress.find({ courseId });
  return docs.map(toProgress);
}
