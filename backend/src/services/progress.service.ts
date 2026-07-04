// Progress service (Progress Tracking). Persists per-(student,course) progress
// and derives module/course completion + certificate eligibility. Enforces the
// sequential rule: lesson N can only be completed once lesson N-1 is complete.

import { Module } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { Progress, toProgress, type ProgressView } from "../models/Progress";
import { publishedAssessmentIds } from "./assessment.service";
import { issueCertificate } from "./certificate.service";

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
  byModule: Map<string, string[]>; // moduleId → ordered lessonIds
  sequence: string[]; // flat ordered lessonIds (module order → lesson order)
}

async function courseStructure(courseId: string): Promise<Structure> {
  const modules = await Module.find({ courseId }).sort({ order: 1, createdAt: 1 });
  const lessons = await Lesson.find({ courseId }).sort({ order: 1, createdAt: 1 });
  const byModule = new Map<string, string[]>();
  const sequence: string[] = [];
  const moduleIds: string[] = [];
  for (const m of modules) {
    const mid = String(m._id);
    moduleIds.push(mid);
    const ls = lessons.filter((l) => l.moduleId === mid).map((l) => String(l._id));
    byModule.set(mid, ls);
    sequence.push(...ls);
  }
  return { moduleIds, byModule, sequence };
}

async function getOrCreate(studentId: string, courseId: string) {
  const existing = await Progress.findOne({ studentId, courseId });
  if (existing) return existing;
  return Progress.create({ studentId, courseId });
}

/** Recompute derived fields (modules complete, overall %, certificate) in place. */
async function recompute(
  doc: Awaited<ReturnType<typeof getOrCreate>>,
  struct: Structure,
): Promise<void> {
  const completed = new Set(doc.completedLessons ?? []);
  doc.completedModules = struct.moduleIds.filter((mid) => {
    const ls = struct.byModule.get(mid) ?? [];
    return ls.length > 0 && ls.every((l) => completed.has(l));
  });
  const total = struct.sequence.length;
  const done = struct.sequence.filter((l) => completed.has(l)).length;
  doc.overallProgress = total > 0 ? Math.round((done / total) * 100) : 0;

  const mandatory = await publishedAssessmentIds(doc.courseId);
  const passed = new Set((doc.assessmentScores ?? []).filter((a) => a.passed).map((a) => a.assessmentId));
  const allAssessmentsPassed = mandatory.every((id) => passed.has(id));
  doc.certificateEligible = doc.overallProgress === 100 && allAssessmentsPassed;
}

export interface ProgressDetail {
  progress: ProgressView;
  totalLessons: number;
  /** First not-yet-completed lesson the student may access (null = all done). */
  nextLessonId: string | null;
}

async function detail(
  doc: Awaited<ReturnType<typeof getOrCreate>>,
  struct: Structure,
): Promise<ProgressDetail> {
  const completed = new Set(doc.completedLessons ?? []);
  const nextLessonId = struct.sequence.find((l) => !completed.has(l)) ?? null;
  return { progress: toProgress(doc), totalLessons: struct.sequence.length, nextLessonId };
}

/** Read (creating an empty record if needed) — includes next unlocked lesson. */
export async function getProgress(studentId: string, courseId: string): Promise<ProgressDetail> {
  const doc = await getOrCreate(studentId, courseId);
  const struct = await courseStructure(courseId);
  return detail(doc, struct);
}

export type CompleteResult =
  | { ok: true; detail: ProgressDetail }
  | { ok: false; reason: "not_found" | "locked" };

/**
 * Mark a lesson complete. Sequential rule: the immediately-preceding lesson in
 * the flat course sequence must already be complete. Idempotent.
 */
export async function markLessonComplete(
  studentId: string,
  courseId: string,
  lessonId: string,
): Promise<CompleteResult> {
  const struct = await courseStructure(courseId);
  const idx = struct.sequence.indexOf(lessonId);
  if (idx === -1) return { ok: false, reason: "not_found" };

  const doc = await getOrCreate(studentId, courseId);
  const completed = new Set(doc.completedLessons ?? []);
  if (idx > 0 && !completed.has(struct.sequence[idx - 1])) {
    return { ok: false, reason: "locked" };
  }
  if (!completed.has(lessonId)) {
    doc.completedLessons = [...(doc.completedLessons ?? []), lessonId];
  }
  doc.lastVisitedLessonId = lessonId;
  await recompute(doc, struct);
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
  const doc = await getOrCreate(studentId, courseId);
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
  const struct = await courseStructure(courseId);
  await recompute(doc, struct);
  await doc.save();
  await maybeIssueCertificate(doc);
  return detail(doc, struct);
}

export async function setLastVisited(
  studentId: string,
  courseId: string,
  lessonId: string,
): Promise<ProgressDetail> {
  const doc = await getOrCreate(studentId, courseId);
  doc.lastVisitedLessonId = lessonId;
  await doc.save();
  return getProgress(studentId, courseId);
}

export async function addTimeSpent(
  studentId: string,
  courseId: string,
  minutes: number,
): Promise<ProgressDetail> {
  const doc = await getOrCreate(studentId, courseId);
  doc.timeSpentMinutes = (doc.timeSpentMinutes ?? 0) + Math.max(0, Math.round(minutes));
  await doc.save();
  return getProgress(studentId, courseId);
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
