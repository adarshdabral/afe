// Progress service (Progress Tracking) — the server-side authority for what each
// student has completed and may open next. One Progress row per (student, course)
// stores completed topics + best assessment results; everything else is DERIVED per
// student from the course's published content (see shared/sequence.ts):
//   topics → each lesson's required assignment → the module's graded assessment
// Rule: an item may be opened/completed only once the item before it is complete,
// so Module N+1 unlocks only when Module N's topics, required assignments and
// assessment are done. Nothing like `module.completed` is ever stored on content.

import { Module } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { Topic } from "../models/Topic";
import { Assessment } from "../models/Assessment";
import { ForumThread } from "../models/ForumThread";
import { ForumPost } from "../models/ForumPost";
import { Progress, toProgress, type ProgressView } from "../models/Progress";
import { issueCertificate } from "./certificate.service";
import { finalizeExpiredAttempts } from "./assessment.service";
import { cachedContent } from "../cache/content-cache";
import { HttpError } from "../http/errors";
import {
  buildSequence,
  doneSet,
  isItemUnlocked,
  isModuleComplete,
  nextItem,
  type SequenceInput,
  type SequenceItem,
} from "../shared/sequence";

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
  modules: SequenceInput[];
  /** Ordered items (topics, required assignments, module assessments). */
  seq: SequenceItem[];
  /** Ordered topic ids. */
  topics: string[];
  /** Assessments/assignments that must be passed for the certificate. */
  mandatory: string[];
  /** Every published assessment/assignment id → its module (incl. optional assignments). */
  assessmentModule: Map<string, string>;
  /** Discussion topics whose participation is required: topicId → true. */
  requiredDiscussions: Set<string>;
}

/** The course's learning sequence (published content) — cached, invalidated on CMS writes. */
function courseStructure(courseId: string): Promise<Structure> {
  return cachedContent(`structure:${courseId}`, () => loadCourseStructure(courseId));
}

async function loadCourseStructure(courseId: string): Promise<Structure> {
  const [modules, lessons, topics, assessments] = await Promise.all([
    Module.find({ courseId, isPublished: true }).sort({ order: 1, createdAt: 1 }).select("_id").lean(),
    Lesson.find({ courseId }).sort({ order: 1, createdAt: 1 }).select("_id moduleId").lean(),
    // Draft topics (isPublished: false) are invisible to students and not in the sequence.
    Topic.find({ courseId, isPublished: { $ne: false } }).sort({ order: 1, createdAt: 1 }).select("_id lessonId order contentType discussion.required").lean(),
    Assessment.find({ courseId, isPublished: true }).select("_id kind moduleId lessonId isRequired order").lean(),
  ]);
  const topicsByLesson = new Map<string, { id: string; order: number }[]>();
  const requiredDiscussions = new Set<string>();
  for (const t of topics) {
    if (!topicsByLesson.has(t.lessonId)) topicsByLesson.set(t.lessonId, []);
    topicsByLesson.get(t.lessonId)!.push({ id: String(t._id), order: t.order ?? 0 });
    if (t.contentType === "discussion" && (t as { discussion?: { required?: boolean } }).discussion?.required) {
      requiredDiscussions.add(String(t._id));
    }
  }
  const moduleAssessment = new Map<string, string>();
  const lessonAssignments = new Map<string, { id: string; isRequired: boolean; order: number | null }[]>();
  const assessmentModule = new Map<string, string>();
  for (const a of assessments) {
    assessmentModule.set(String(a._id), a.moduleId);
    if (a.kind === "lesson" && a.lessonId) {
      if (!lessonAssignments.has(a.lessonId)) lessonAssignments.set(a.lessonId, []);
      lessonAssignments.get(a.lessonId)!.push({ id: String(a._id), isRequired: a.isRequired !== false, order: typeof a.order === "number" ? a.order : null });
    } else moduleAssessment.set(a.moduleId, String(a._id));
  }
  const lessonsByModule = new Map<string, SequenceInput["lessons"]>();
  for (const l of lessons) {
    const lid = String(l._id);
    if (!lessonsByModule.has(l.moduleId)) lessonsByModule.set(l.moduleId, []);
    lessonsByModule.get(l.moduleId)!.push({ id: lid, topics: topicsByLesson.get(lid) ?? [], assignments: lessonAssignments.get(lid) ?? [] });
  }
  const seqModules: SequenceInput[] = modules.map((m) => ({
    id: String(m._id),
    assessmentId: moduleAssessment.get(String(m._id)) ?? null,
    lessons: lessonsByModule.get(String(m._id)) ?? [],
  }));
  const seq = buildSequence(seqModules);
  return {
    modules: seqModules,
    seq,
    topics: seq.filter((i) => i.kind === "topic").map((i) => i.id),
    mandatory: seq.filter((i) => i.kind !== "topic").map((i) => i.id),
    assessmentModule,
    requiredDiscussions,
  };
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
type ProgressDoc = Awaited<ReturnType<typeof getOrCreate>>;

const passedIds = (doc: ProgressDoc) =>
  (doc.assessmentScores ?? []).filter((a) => a.passed).map((a) => a.assessmentId ?? "");
const doneOf = (doc: ProgressDoc) => doneSet(doc.completedTopics ?? [], passedIds(doc));

/** Recompute derived fields (modules complete, overall %, certificate) in place. */
function recompute(doc: ProgressDoc, struct: Structure): void {
  const done = doneOf(doc);
  doc.completedModules = struct.modules.map((m) => m.id).filter((mid) => isModuleComplete(struct.seq, done, mid));
  const total = struct.topics.length;
  const finished = struct.topics.filter((t) => done.has(t)).length;
  doc.overallProgress = total > 0 ? Math.round((finished / total) * 100) : 0;
  doc.certificateEligible = doc.overallProgress === 100 && struct.mandatory.every((id) => done.has(id));
}

export interface ProgressDetail {
  progress: ProgressView;
  totalTopics: number;
  /** First not-yet-completed topic (null = all topics done). */
  nextTopicId: string | null;
  /** First not-yet-completed item of any kind — where "Continue" should go. */
  nextItem: { id: string; kind: SequenceItem["kind"]; moduleId: string } | null;
}

function detail(doc: ProgressDoc, struct: Structure): ProgressDetail {
  const done = doneOf(doc);
  const next = nextItem(struct.seq, done);
  return {
    progress: toProgress(doc),
    totalTopics: struct.topics.length,
    nextTopicId: struct.topics.find((t) => !done.has(t)) ?? null,
    nextItem: next ? { id: next.id, kind: next.kind, moduleId: next.moduleId } : null,
  };
}

/** Merge assessment results (keeps best score / any pass) into the doc, in place. */
function mergeResults(doc: ProgressDoc, results: { assessmentId: string; score: number; passed: boolean }[]): void {
  if (results.length === 0) return;
  // Work on a plain array (avoids Mongoose subdocument-array typing) then set().
  const scores = (doc.assessmentScores ?? []).map((a) => ({
    assessmentId: a.assessmentId ?? "",
    score: a.score ?? 0,
    passed: a.passed === true,
  }));
  for (const result of results) {
    const existing = scores.find((a) => a.assessmentId === result.assessmentId);
    if (existing) {
      existing.score = Math.max(existing.score, result.score);
      existing.passed = existing.passed || result.passed;
    } else {
      scores.push({ ...result });
    }
  }
  doc.set("assessmentScores", scores);
}

/**
 * Read (creating an empty record if needed). Attempts whose timer ran out while the
 * student was away are graded here first, so completion is always up to date.
 */
export async function getProgress(studentId: string, courseId: string): Promise<ProgressDetail> {
  const [expired, struct] = await Promise.all([finalizeExpiredAttempts(studentId, courseId), courseStructure(courseId)]);
  const doc = await getOrCreate(studentId, courseId);
  if (expired.length) {
    mergeResults(doc, expired);
    recompute(doc, struct);
    await doc.save();
    await maybeIssueCertificate(doc);
  }
  return detail(doc, struct);
}

export type AccessResult = { ok: true } | { ok: false; reason: "not_found" | "locked"; message: string };

/**
 * May this student open the item (topic, assignment or module assessment)?
 * The check every content/attempt endpoint runs before serving a student.
 */
export async function checkItemAccess(studentId: string, courseId: string, itemId: string): Promise<AccessResult> {
  const [struct, doc] = await Promise.all([courseStructure(courseId), getOrCreate(studentId, courseId)]);
  return accessFrom(struct, doc, itemId);
}

function accessFrom(struct: Structure, doc: ProgressDoc, itemId: string): AccessResult {
  const inSeq = struct.seq.some((i) => i.id === itemId);
  const moduleId = struct.assessmentModule.get(itemId);
  if (!inSeq && !moduleId) return { ok: false, reason: "not_found", message: "This item isn't part of the course." };
  const done = doneOf(doc);
  if (isItemUnlocked(struct.seq, done, itemId, moduleId)) return { ok: true };
  return { ok: false, reason: "locked", message: lockedMessage(struct, itemId, moduleId) };
}

function lockedMessage(struct: Structure, itemId: string, moduleId?: string): string {
  const item = struct.seq.find((i) => i.id === itemId);
  const mid = item?.moduleId ?? moduleId;
  const mIndex = struct.modules.findIndex((m) => m.id === mid);
  const first = struct.seq.find((i) => i.moduleId === mid);
  // The module itself is locked → point at the previous module.
  if (mIndex > 0 && first && (first.id === itemId || !item)) return `Complete Module ${mIndex} to unlock this module.`;
  if (item?.kind === "assessment") return "Complete every lesson and required assignment in this module first.";
  if (item?.kind === "assignment") return "Complete this lesson's topics before its assignment.";
  return "Complete the previous item to unlock this one.";
}

export type CompleteResult =
  | { ok: true; detail: ProgressDetail }
  | { ok: false; reason: "not_found" | "locked" | "discussion"; message?: string };

/**
 * Mark a topic complete. Sequential rule: the item before it (topic, required
 * assignment or the previous module's assessment) must already be complete; a
 * required discussion also needs the student's own post in its thread. Idempotent.
 */
export async function markTopicComplete(
  studentId: string,
  courseId: string,
  topicId: string,
): Promise<CompleteResult> {
  const [struct, doc] = await Promise.all([courseStructure(courseId), getOrCreate(studentId, courseId)]);
  if (!struct.topics.includes(topicId)) return { ok: false, reason: "not_found" };
  const access = accessFrom(struct, doc, topicId);
  if (!access.ok) return { ok: false, reason: "locked", message: access.message };
  if (struct.requiredDiscussions.has(topicId) && !(doc.completedTopics ?? []).includes(topicId)) {
    if (!(await hasPostedInDiscussion(studentId, topicId))) {
      return { ok: false, reason: "discussion", message: "Post in the discussion before marking it complete." };
    }
  }
  if (!(doc.completedTopics ?? []).includes(topicId)) {
    doc.completedTopics = [...(doc.completedTopics ?? []), topicId];
  }
  doc.lastVisitedTopicId = topicId;
  recompute(doc, struct);
  await doc.save();
  await maybeIssueCertificate(doc);
  return { ok: true, detail: detail(doc, struct) };
}

/** Has the student started or replied to (visible) the discussion's thread? */
async function hasPostedInDiscussion(studentId: string, topicId: string): Promise<boolean> {
  const thread = await ForumThread.findOne({ topicId }).select("_id authorId").lean();
  if (!thread) return false;
  if (thread.authorId === studentId) return true;
  return !!(await ForumPost.exists({ threadId: String(thread._id), authorId: studentId, hidden: false }));
}

/** Merge an assessment result (keeps best score) and recompute completion. */
export async function applyAssessmentResult(
  studentId: string,
  courseId: string,
  result: { assessmentId: string; score: number; passed: boolean },
): Promise<ProgressDetail> {
  const [doc, struct] = await Promise.all([getOrCreate(studentId, courseId), courseStructure(courseId)]);
  mergeResults(doc, [result]);
  recompute(doc, struct);
  await doc.save();
  await maybeIssueCertificate(doc);
  return detail(doc, struct);
}

export async function setLastVisited(
  studentId: string,
  courseId: string,
  topicId: string,
): Promise<ProgressDetail> {
  const access = await checkItemAccess(studentId, courseId, topicId);
  if (!access.ok) throw new HttpError(access.reason === "locked" ? 403 : 404, access.message);
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
