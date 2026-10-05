// Assessment service (Assessment Engine) — module assessments AND lesson assignments
// (one Assessment model, `kind` = "module" | "lesson"). Admin CRUD for assessments +
// questions, the student-facing (answer-key-stripped) view, attempts and grading.
//
// Attempts are SERVER-timed: POST …/start creates (or resumes) an in-progress
// attempt whose `deadline` is stored here; answers autosave to it; a submit later
// than deadline + GRACE_MS is refused and the saved answers are submitted instead.
// An attempt left to expire is graded from its saved answers the next time the
// student touches it or their progress (finalizeExpiredAttempts).
//
// Grading: MCQ is auto-graded against correctAnswer; open-ended (reflection /
// scenario) earns full marks for a non-empty answer (participation). Graded → pass
// = percentage ≥ passingScore. Non-graded → submitting completes it (passed = true).

import { Assessment, MODULE_KIND, toAssessment, type AssessmentDoc, type AssessmentView } from "../models/Assessment";
import {
  Question,
  toQuestion,
  toPublicQuestion,
  type QuestionDoc,
  type QuestionType,
  type QuestionView,
  type QuestionPublicView,
} from "../models/Question";
import { Attempt, SUBMITTED, toAttempt, type AttemptDoc, type AttemptView } from "../models/Attempt";
import { Module } from "../models/Module";
import { Lesson } from "../models/Lesson";
import { HttpError } from "../http/errors";
import { cachedContent } from "../cache/content-cache";

/** Network slack allowed after the deadline for the client's own auto-submit. */
export const GRACE_MS = 5_000;

export interface AssessmentConfigInput {
  title?: string;
  description?: string;
  instructions?: string;
  isGraded?: boolean;
  isRequired?: boolean;
  passingScore?: number;
  estimatedDurationMinutes?: number;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  availableFrom?: string | null;
  availableUntil?: string | null;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  autoSubmitOnTimeout?: boolean;
}

export interface CreateAssessmentInput extends AssessmentConfigInput {
  /** Module assessment: the module. */
  moduleId?: string;
  /** Lesson assignment: the lesson (module/course are taken from it). */
  lessonId?: string;
  title: string;
}

const CONFIG_KEYS = [
  "description",
  "instructions",
  "isGraded",
  "isRequired",
  "passingScore",
  "estimatedDurationMinutes",
  "timeLimitMinutes",
  "maxAttempts",
  "shuffleQuestions",
  "shuffleOptions",
  "autoSubmitOnTimeout",
] as const;

const toDate = (v: string | null | undefined) => (v ? new Date(v) : null);

/** True if the module already has its (module) assessment. */
export async function moduleHasAssessment(moduleId: string): Promise<boolean> {
  return !!(await Assessment.exists({ moduleId, ...MODULE_KIND }));
}

/** True if the lesson already has its assignment. */
export async function lessonHasAssignment(lessonId: string): Promise<boolean> {
  return !!(await Assessment.exists({ lessonId, kind: "lesson" }));
}

/** Create a module assessment (moduleId) or a lesson assignment (lessonId). Null if the parent doesn't exist. */
export async function createAssessment(input: CreateAssessmentInput): Promise<AssessmentView | null> {
  let parent: { kind: "module" | "lesson"; moduleId: string; lessonId: string | null; courseId: string } | null = null;
  if (input.lessonId) {
    const lesson = await Lesson.findById(input.lessonId).catch(() => null);
    if (lesson) parent = { kind: "lesson", moduleId: lesson.moduleId, lessonId: String(lesson._id), courseId: lesson.courseId };
  } else if (input.moduleId) {
    const module = await Module.findById(input.moduleId).catch(() => null);
    if (module) parent = { kind: "module", moduleId: String(module._id), lessonId: null, courseId: module.courseId };
  }
  if (!parent) return null;
  const doc = await Assessment.create({
    ...parent,
    title: input.title.trim(),
    // Assignments are non-graded by default; module assessments are graded.
    isGraded: input.isGraded ?? parent.kind === "module",
    ...Object.fromEntries(CONFIG_KEYS.filter((k) => k !== "isGraded" && input[k] !== undefined).map((k) => [k, input[k]])),
    availableFrom: toDate(input.availableFrom),
    availableUntil: toDate(input.availableUntil),
  });
  return toAssessment(doc);
}

export async function getAssessment(id: string): Promise<AssessmentView | null> {
  const doc = await Assessment.findById(id).catch(() => null);
  return doc ? toAssessment(doc) : null;
}

export async function getAssessmentForModule(moduleId: string): Promise<AssessmentView | null> {
  const doc = await Assessment.findOne({ moduleId, ...MODULE_KIND });
  return doc ? toAssessment(doc) : null;
}

export async function getAssessmentForLesson(lessonId: string): Promise<AssessmentView | null> {
  const doc = await Assessment.findOne({ lessonId, kind: "lesson" });
  return doc ? toAssessment(doc) : null;
}

export async function updateAssessment(id: string, patch: AssessmentConfigInput): Promise<AssessmentView | null> {
  const doc = await Assessment.findById(id).catch(() => null);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim();
  for (const k of CONFIG_KEYS) if (patch[k] !== undefined) doc.set(k, patch[k]);
  if (patch.availableFrom !== undefined) doc.set("availableFrom", toDate(patch.availableFrom));
  if (patch.availableUntil !== undefined) doc.set("availableUntil", toDate(patch.availableUntil));
  await doc.save();
  return toAssessment(doc);
}

/** A published module must keep a published assessment with questions. */
async function assertModuleNotPublished(doc: AssessmentDoc, action: string): Promise<void> {
  if (doc.kind === "lesson") return; // lesson assignments don't gate module publishing
  const m = await Module.findById(doc.moduleId).catch(() => null);
  if (m?.isPublished) {
    throw new HttpError(409, `Can't ${action}: its module is published, and every published module needs its assessment. Hide the module first.`);
  }
}

export async function setAssessmentPublished(id: string, isPublished: boolean): Promise<AssessmentView | null> {
  const doc = await Assessment.findById(id).catch(() => null);
  if (!doc) return null;
  if (!isPublished && doc.isPublished) await assertModuleNotPublished(doc, "unpublish this assessment");
  if (isPublished && (await Question.countDocuments({ assessmentId: id })) === 0) {
    throw new HttpError(409, "Add at least one question before publishing.");
  }
  doc.isPublished = isPublished;
  await doc.save();
  return toAssessment(doc);
}

export async function deleteAssessment(id: string): Promise<boolean> {
  const doc = await Assessment.findById(id).catch(() => null);
  if (!doc) return false;
  await assertModuleNotPublished(doc, "delete this assessment");
  await Question.deleteMany({ assessmentId: id });
  await Attempt.deleteMany({ assessmentId: id });
  await doc.deleteOne();
  return true;
}

/** Cascade for lesson/module deletion: remove their assessments, questions and attempts. */
export async function deleteAssessmentsWhere(filter: { lessonId: string } | { moduleId: string }): Promise<void> {
  const ids = (await Assessment.find(filter).select("_id").lean()).map((a) => String(a._id));
  if (ids.length === 0) return;
  await Question.deleteMany({ assessmentId: { $in: ids } });
  await Attempt.deleteMany({ assessmentId: { $in: ids } });
  await Assessment.deleteMany({ _id: { $in: ids } });
}

// ---- Questions ----
export interface CreateQuestionInput {
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  marks?: number;
}

export async function addQuestion(assessmentId: string, input: CreateQuestionInput): Promise<QuestionView | null> {
  const assessment = await Assessment.findById(assessmentId).catch(() => null);
  if (!assessment) return null;
  const last = await Question.findOne({ assessmentId }).sort({ order: -1 });
  const order = last ? (last.order ?? 0) + 1 : 0;
  const doc = await Question.create({
    assessmentId,
    courseId: assessment.courseId,
    type: input.type,
    question: input.question,
    options: input.options ?? [],
    correctAnswer: input.correctAnswer ?? "",
    explanation: input.explanation ?? "",
    marks: input.marks ?? 1,
    order,
  });
  return toQuestion(doc);
}

export async function updateQuestion(questionId: string, patch: Partial<CreateQuestionInput>): Promise<QuestionView | null> {
  const doc = await Question.findById(questionId).catch(() => null);
  if (!doc) return null;
  if (patch.type !== undefined) doc.type = patch.type;
  if (patch.question !== undefined) doc.question = patch.question;
  if (patch.options !== undefined) doc.options = patch.options;
  if (patch.correctAnswer !== undefined) doc.correctAnswer = patch.correctAnswer;
  if (patch.explanation !== undefined) doc.explanation = patch.explanation;
  if (patch.marks !== undefined) doc.marks = patch.marks;
  await doc.save();
  return toQuestion(doc);
}

export async function deleteQuestion(questionId: string): Promise<boolean> {
  const doc = await Question.findById(questionId).catch(() => null);
  if (!doc) return false;
  const assessment = await Assessment.findById(doc.assessmentId).catch(() => null);
  if (assessment?.isPublished && (await Question.countDocuments({ assessmentId: doc.assessmentId })) <= 1) {
    throw new HttpError(409, "A published assessment needs at least one question. Add another question first, or unpublish it.");
  }
  await doc.deleteOne();
  return true;
}

export async function reorderQuestions(assessmentId: string, orderedIds: string[]): Promise<QuestionView[] | null> {
  const assessment = await Assessment.findById(assessmentId).catch(() => null);
  if (!assessment) return null;
  const owned = new Set((await Question.find({ assessmentId }).select("_id")).map((q) => String(q._id)));
  let order = 0;
  for (const id of orderedIds) {
    if (!owned.has(id)) continue;
    await Question.updateOne({ _id: id, assessmentId }, { order });
    order += 1;
  }
  return listQuestions(assessmentId);
}

/** Admin: full questions (with answer key), ordered. */
export async function listQuestions(assessmentId: string): Promise<QuestionView[]> {
  const docs = await Question.find({ assessmentId }).sort({ order: 1, createdAt: 1 });
  return docs.map(toQuestion);
}

// ---- Student: attempts ----

export interface GradedAnswer {
  questionId: string;
  yourAnswer: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  marks: number;
  earned: number;
}

export interface SubmitResult {
  attempt: AttemptView;
  review: GradedAnswer[];
}

export interface AttemptState {
  /** Submitted attempts so far. */
  submittedAttempts: number;
  maxAttempts: number;
  /** null = unlimited. */
  attemptsRemaining: number | null;
  best: { score: number; passed: boolean } | null;
  /** The in-progress attempt to resume (answers = autosaved draft). */
  active: { id: string; startedAt: string | null; deadline: string | null; answers: { questionId: string; answer: string }[] } | null;
  available: boolean;
  availabilityMessage: string | null;
  /** Server clock, so the client countdown can correct for clock skew. */
  serverNow: string;
}

export interface StudentAssessmentView {
  assessment: AssessmentView;
  /** Answer keys stripped. Empty for a timed assessment until an attempt is started. */
  questions: QuestionPublicView[];
  state: AttemptState;
}

type Answer = { questionId: string; answer: string };
type ExpiredResult = { assessmentId: string; score: number; passed: boolean };

function availabilityOf(a: AssessmentDoc, now = new Date()): { available: boolean; message: string | null } {
  if (a.availableFrom && now < new Date(a.availableFrom)) {
    return { available: false, message: `Opens ${new Date(a.availableFrom).toUTCString()}.` };
  }
  if (a.availableUntil && now > new Date(a.availableUntil)) {
    return { available: false, message: `Closed ${new Date(a.availableUntil).toUTCString()}.` };
  }
  return { available: true, message: null };
}

const isExpired = (att: { deadline?: Date | null }, now = Date.now()) =>
  !!att.deadline && now > new Date(att.deadline).getTime() + GRACE_MS;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function publishedOrThrow(assessmentId: string): Promise<AssessmentDoc> {
  const doc = await Assessment.findById(assessmentId).catch(() => null);
  if (!doc || doc.isPublished !== true) throw new HttpError(404, "Assessment not available.");
  return doc;
}

/** The course of a published assessment (for access checks), or null. */
export async function publishedAssessmentCourse(assessmentId: string): Promise<string | null> {
  const courseId = await cachedContent(`assessment-course:${assessmentId}`, async () => {
    const doc = await Assessment.findById(assessmentId).select("courseId isPublished").lean().catch(() => null);
    return doc && doc.isPublished ? doc.courseId : null;
  });
  return courseId ?? null;
}

function grade(assessment: AssessmentDoc, questions: QuestionDoc[], answers: Answer[]) {
  const answerMap = new Map(answers.map((a) => [a.questionId, (a.answer ?? "").trim()]));
  let totalMarks = 0;
  let earnedMarks = 0;
  const review: GradedAnswer[] = [];
  for (const q of questions) {
    const marks = q.marks ?? 1;
    totalMarks += marks;
    const your = answerMap.get(String(q._id)) ?? "";
    // MCQ: exact option; open-ended: participation credit for a non-empty response.
    const correct = q.type === "mcq" ? your.length > 0 && your === (q.correctAnswer ?? "").trim() : your.length > 0;
    const earned = correct ? marks : 0;
    earnedMarks += earned;
    review.push({
      questionId: String(q._id),
      yourAnswer: your,
      correct,
      correctAnswer: q.correctAnswer ?? "",
      explanation: q.explanation ?? "",
      marks,
      earned,
    });
  }
  const score = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
  const passed = assessment.isGraded === false ? true : score >= (assessment.passingScore ?? 60);
  return { score, earnedMarks, totalMarks, passed, review };
}

type LooseAnswer = { questionId?: string | null; answer?: string | null };
const cleanAnswers = (answers: LooseAnswer[]): Answer[] => answers.map((a) => ({ questionId: a.questionId ?? "", answer: a.answer ?? "" }));
/** An attempt's autosaved answers as plain objects. */
const draftOf = (att: AttemptDoc): Answer[] => cleanAnswers(att.draftAnswers ?? []);

/** Grade an in-progress attempt and mark it submitted (atomically — exactly once). */
async function finalizeAttempt(
  att: AttemptDoc,
  assessment: AssessmentDoc,
  answers: Answer[],
  auto: boolean,
): Promise<SubmitResult | null> {
  const questions = await Question.find({ assessmentId: String(assessment._id) }).sort({ order: 1 });
  // Timed out with auto-submit disabled → the attempt closes with nothing graded.
  const counted = auto && assessment.autoSubmitOnTimeout === false ? [] : answers;
  const graded = grade(assessment, questions, counted);
  const doc = await Attempt.findOneAndUpdate(
    { _id: att._id, status: "in_progress" },
    {
      $set: {
        status: "submitted",
        answers: cleanAnswers(counted),
        score: graded.score,
        earnedMarks: graded.earnedMarks,
        totalMarks: graded.totalMarks,
        passed: graded.passed,
        autoSubmitted: auto,
        submittedAt: new Date().toISOString(),
      },
    },
    { new: true },
  );
  if (!doc) return null; // already finalized by a concurrent request
  return { attempt: toAttempt(doc), review: graded.review };
}

const asResult = (assessmentId: string, res: SubmitResult | null): ExpiredResult[] =>
  res ? [{ assessmentId, score: res.attempt.score, passed: res.attempt.passed }] : [];

/**
 * Grade every in-progress attempt of this student (optionally in one course) whose
 * deadline has passed, from its autosaved answers. Returns the results so the
 * caller can merge them into progress.
 */
export async function finalizeExpiredAttempts(studentId: string, courseId?: string): Promise<ExpiredResult[]> {
  const stale = await Attempt.find({
    studentId,
    status: "in_progress",
    deadline: { $ne: null, $lt: new Date(Date.now() - GRACE_MS) },
    ...(courseId ? { courseId } : {}),
  });
  const out: ExpiredResult[] = [];
  for (const att of stale) {
    const assessment = await Assessment.findById(att.assessmentId).catch(() => null);
    if (!assessment) continue;
    out.push(...asResult(att.assessmentId, await finalizeAttempt(att, assessment, draftOf(att), true)));
  }
  return out;
}

async function stateFor(assessment: AssessmentDoc, studentId: string, active: AttemptDoc | null): Promise<AttemptState> {
  const submitted = studentId
    ? await Attempt.find({ assessmentId: String(assessment._id), studentId, ...SUBMITTED }).select("score passed").lean()
    : [];
  const max = assessment.maxAttempts ?? 0;
  const best: AttemptState["best"] = submitted.length
    ? { score: Math.max(...submitted.map((a) => a.score ?? 0)), passed: submitted.some((a) => !!a.passed) }
    : null;
  const { available, message } = availabilityOf(assessment);
  return {
    submittedAttempts: submitted.length,
    maxAttempts: max,
    attemptsRemaining: max > 0 ? Math.max(0, max - submitted.length) : null,
    best,
    active: active
      ? {
          id: String(active._id),
          startedAt: active.startedAt ? new Date(active.startedAt).toISOString() : null,
          deadline: active.deadline ? new Date(active.deadline).toISOString() : null,
          answers: draftOf(active),
        }
      : null,
    available,
    availabilityMessage: message,
    serverNow: new Date().toISOString(),
  };
}

/** Questions in this attempt's order (shuffled per attempt when configured), answer keys stripped. */
async function questionsFor(assessment: AssessmentDoc, attempt: AttemptDoc | null): Promise<QuestionPublicView[]> {
  const docs = await Question.find({ assessmentId: String(assessment._id) }).sort({ order: 1, createdAt: 1 });
  let qs = docs.map(toPublicQuestion);
  if (attempt?.questionOrder?.length) {
    const pos = new Map(attempt.questionOrder.map((id, i) => [id, i]));
    qs = [...qs].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  } else if (assessment.shuffleQuestions) {
    qs = shuffle(qs);
  }
  const optionOrders = new Map((attempt?.optionOrders ?? []).map((o) => [o.questionId ?? "", o.options ?? []]));
  return qs.map((q) => {
    const order = optionOrders.get(q.id);
    if (order && order.length === q.options.length) return { ...q, options: order };
    if (!attempt && assessment.shuffleOptions && q.type === "mcq") return { ...q, options: shuffle(q.options) };
    return q;
  });
}

const activeOf = (assessmentId: string, studentId: string) =>
  Attempt.findOne({ assessmentId, studentId, status: "in_progress" });

export interface WithExpired<T> {
  value: T;
  /** Attempts the server just auto-submitted (merge into progress). */
  expired: ExpiredResult[];
}

/** Close this student's expired attempt at this assessment, if any; return the live one. */
async function sweep(assessment: AssessmentDoc, studentId: string): Promise<WithExpired<AttemptDoc | null>> {
  const active = await activeOf(String(assessment._id), studentId);
  if (active && isExpired(active)) {
    const res = await finalizeAttempt(active, assessment, draftOf(active), true);
    return { value: null, expired: asResult(String(assessment._id), res) };
  }
  return { value: active, expired: [] };
}

/** Student (or staff preview with studentId null): the assessment, attempt state, and
 *  questions only when they may be seen. */
export async function getStudentAssessment(
  assessmentId: string,
  studentId: string | null,
): Promise<WithExpired<StudentAssessmentView>> {
  const assessment = await publishedOrThrow(assessmentId);
  const timed = (assessment.timeLimitMinutes ?? 0) > 0;
  if (!studentId) {
    return {
      value: { assessment: toAssessment(assessment), questions: await questionsFor(assessment, null), state: await stateFor(assessment, "", null) },
      expired: [],
    };
  }
  const { value: active, expired } = await sweep(assessment, studentId);
  const state = await stateFor(assessment, studentId, active);
  // A timed assessment's questions are only revealed once its clock is running.
  const questions = timed && !active ? [] : await questionsFor(assessment, active);
  return { value: { assessment: toAssessment(assessment), questions, state }, expired };
}

/** Start (or resume) an attempt. Timed attempts get their server-side deadline here. */
export async function startAttempt(assessmentId: string, studentId: string): Promise<WithExpired<StudentAssessmentView>> {
  const assessment = await publishedOrThrow(assessmentId);
  const { value: existing, expired } = await sweep(assessment, studentId);
  let active = existing;
  if (!active) {
    const label = assessment.kind === "lesson" ? "assignment" : "assessment";
    const { available, message } = availabilityOf(assessment);
    if (!available) throw new HttpError(403, `This ${label} is not available. ${message ?? ""}`.trim());
    const max = assessment.maxAttempts ?? 0;
    if (max > 0 && (await Attempt.countDocuments({ assessmentId, studentId, ...SUBMITTED })) >= max) {
      throw new HttpError(409, "You have used all your attempts.");
    }
    const questions = await Question.find({ assessmentId }).sort({ order: 1, createdAt: 1 }).select("_id type options").lean();
    const now = new Date();
    const minutes = assessment.timeLimitMinutes ?? 0;
    try {
      active = await Attempt.create({
        studentId,
        assessmentId,
        courseId: assessment.courseId,
        status: "in_progress",
        startedAt: now,
        deadline: minutes > 0 ? new Date(now.getTime() + minutes * 60_000) : null,
        questionOrder: (assessment.shuffleQuestions ? shuffle(questions) : questions).map((q) => String(q._id)),
        optionOrders: assessment.shuffleOptions
          ? questions.filter((q) => q.type === "mcq").map((q) => ({ questionId: String(q._id), options: shuffle(q.options ?? []) }))
          : [],
      });
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err;
      active = await activeOf(assessmentId, studentId); // started concurrently (another tab)
    }
  }
  const state = await stateFor(assessment, studentId, active);
  return { value: { assessment: toAssessment(assessment), questions: await questionsFor(assessment, active), state }, expired };
}

export type DraftOutcome =
  | { ok: true; savedAt: string; deadline: string | null }
  | { ok: false; status: number; message: string; expired: ExpiredResult[] };

/** Autosave answers to the in-progress attempt. Refused (409) once its time is up. */
export async function saveDraft(
  assessmentId: string,
  attemptId: string,
  studentId: string,
  answers: Answer[],
): Promise<DraftOutcome> {
  const assessment = await publishedOrThrow(assessmentId);
  const att = await Attempt.findOne({ _id: attemptId, assessmentId, studentId }).catch(() => null);
  if (!att) return { ok: false, status: 404, message: "Attempt not found.", expired: [] };
  if (att.status !== "in_progress") return { ok: false, status: 409, message: "This attempt has already been submitted.", expired: [] };
  if (isExpired(att)) {
    const res = await finalizeAttempt(att, assessment, draftOf(att), true);
    return { ok: false, status: 409, message: "Time is up — your saved answers were submitted.", expired: asResult(assessmentId, res) };
  }
  att.set("draftAnswers", cleanAnswers(answers));
  await att.save();
  return { ok: true, savedAt: new Date().toISOString(), deadline: att.deadline ? new Date(att.deadline).toISOString() : null };
}

export type SubmitOutcome =
  | { ok: true; result: SubmitResult }
  | { ok: false; status: number; message: string; result?: SubmitResult };

/**
 * Grade + persist a submission. Timed: requires the running attempt and refuses a
 * submit after deadline + GRACE_MS (the saved answers are submitted instead, and
 * returned as `result`). Untimed: finalizes the running attempt if there is one,
 * else creates a submitted attempt directly (attempt limit + availability apply).
 */
export async function submitAttempt(assessmentId: string, studentId: string, answers: Answer[]): Promise<SubmitOutcome> {
  const assessment = await publishedOrThrow(assessmentId);
  const timed = (assessment.timeLimitMinutes ?? 0) > 0;
  const active = await activeOf(assessmentId, studentId);

  if (active && isExpired(active)) {
    const result = await finalizeAttempt(active, assessment, draftOf(active), true);
    return { ok: false, status: 409, message: "Time is up — your saved answers were submitted.", result: result ?? undefined };
  }
  if (active) {
    const result = await finalizeAttempt(active, assessment, answers, false);
    if (!result) return { ok: false, status: 409, message: "This attempt has already been submitted." };
    return { ok: true, result };
  }
  if (timed) return { ok: false, status: 409, message: "Start the attempt first — this one is timed." };

  const { available, message } = availabilityOf(assessment);
  if (!available) return { ok: false, status: 403, message: `Not available. ${message ?? ""}`.trim() };
  const max = assessment.maxAttempts ?? 0;
  if (max > 0 && (await Attempt.countDocuments({ assessmentId, studentId, ...SUBMITTED })) >= max) {
    return { ok: false, status: 409, message: "You have used all your attempts." };
  }
  const questions = await Question.find({ assessmentId }).sort({ order: 1 });
  const graded = grade(assessment, questions, answers);
  const doc = await Attempt.create({
    studentId,
    assessmentId,
    courseId: assessment.courseId,
    status: "submitted",
    answers: cleanAnswers(answers),
    score: graded.score,
    earnedMarks: graded.earnedMarks,
    totalMarks: graded.totalMarks,
    passed: graded.passed,
    startedAt: new Date(),
    submittedAt: new Date().toISOString(),
  });
  return { ok: true, result: { attempt: toAttempt(doc), review: graded.review } };
}

/** A student's SUBMITTED attempts for an assessment, newest first. */
export async function listAttempts(assessmentId: string, studentId: string): Promise<AttemptView[]> {
  const docs = await Attempt.find({ assessmentId, studentId, ...SUBMITTED }).sort({ submittedAt: -1 });
  return docs.map(toAttempt);
}
