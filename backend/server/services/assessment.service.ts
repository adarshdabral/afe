// Assessment service (Assessment Engine). Admin CRUD for assessments + questions,
// student-facing (answer-key-stripped) fetch, grading, and attempt persistence.
// Grading: MCQ is auto-graded against correctAnswer; open-ended (reflection /
// scenario) earns full marks for a non-empty answer (participation). Pass = the
// earned percentage ≥ the assessment's passingScore.

import { Assessment, toAssessment, type AssessmentView } from "../models/Assessment";
import {
  Question,
  toQuestion,
  toPublicQuestion,
  type QuestionType,
  type QuestionView,
  type QuestionPublicView,
} from "../models/Question";
import { Attempt, toAttempt, type AttemptView } from "../models/Attempt";
import { Module } from "../models/Module";
import { HttpError } from "../http/errors";
import { cachedContent } from "../cache/content-cache";

export interface CreateAssessmentInput {
  moduleId: string;
  title: string;
  description?: string;
  passingScore?: number;
  estimatedDurationMinutes?: number;
}

/** True if the module already has an assessment (one-per-module rule). */
export async function moduleHasAssessment(moduleId: string): Promise<boolean> {
  return !!(await Assessment.findOne({ moduleId }));
}

export async function createAssessment(
  input: CreateAssessmentInput,
): Promise<AssessmentView | null> {
  const module = await Module.findById(input.moduleId).catch(() => null);
  if (!module) return null;
  const doc = await Assessment.create({
    moduleId: input.moduleId,
    courseId: module.courseId,
    title: input.title.trim(),
    description: input.description ?? "",
    passingScore: input.passingScore ?? undefined,
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
  });
  return toAssessment(doc);
}

export async function getAssessment(id: string): Promise<AssessmentView | null> {
  const doc = await Assessment.findById(id).catch(() => null);
  return doc ? toAssessment(doc) : null;
}

export async function getAssessmentForModule(moduleId: string): Promise<AssessmentView | null> {
  const doc = await Assessment.findOne({ moduleId });
  return doc ? toAssessment(doc) : null;
}

export async function updateAssessment(
  id: string,
  patch: { title?: string; description?: string; passingScore?: number; estimatedDurationMinutes?: number },
): Promise<AssessmentView | null> {
  const doc = await Assessment.findById(id).catch(() => null);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.passingScore !== undefined) doc.passingScore = patch.passingScore;
  if (patch.estimatedDurationMinutes !== undefined) doc.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  await doc.save();
  return toAssessment(doc);
}

/** A published module must keep a published assessment with questions. */
async function assertModuleNotPublished(moduleId: string, action: string): Promise<void> {
  const m = await Module.findById(moduleId).catch(() => null);
  if (m?.isPublished) {
    throw new HttpError(409, `Can't ${action}: its module is published, and every published module needs its assessment. Hide the module first.`);
  }
}

export async function setAssessmentPublished(
  id: string,
  isPublished: boolean,
): Promise<AssessmentView | null> {
  const doc = await Assessment.findById(id).catch(() => null);
  if (!doc) return null;
  if (!isPublished && doc.isPublished) await assertModuleNotPublished(doc.moduleId, "unpublish this assessment");
  if (isPublished && (await Question.countDocuments({ assessmentId: id })) === 0) {
    throw new HttpError(409, "Add at least one question before publishing the assessment.");
  }
  doc.isPublished = isPublished;
  await doc.save();
  return toAssessment(doc);
}

export async function deleteAssessment(id: string): Promise<boolean> {
  const doc = await Assessment.findById(id).catch(() => null);
  if (!doc) return false;
  await assertModuleNotPublished(doc.moduleId, "delete this assessment");
  await Question.deleteMany({ assessmentId: id });
  await Attempt.deleteMany({ assessmentId: id });
  await doc.deleteOne();
  return true;
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

export async function addQuestion(
  assessmentId: string,
  input: CreateQuestionInput,
): Promise<QuestionView | null> {
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

export async function updateQuestion(
  questionId: string,
  patch: Partial<CreateQuestionInput>,
): Promise<QuestionView | null> {
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
    throw new HttpError(409, "A published assessment needs at least one question. Add another question first, or unpublish the assessment.");
  }
  await doc.deleteOne();
  return true;
}

export async function reorderQuestions(
  assessmentId: string,
  orderedIds: string[],
): Promise<QuestionView[] | null> {
  const assessment = await Assessment.findById(assessmentId).catch(() => null);
  if (!assessment) return null;
  const owned = new Set(
    (await Question.find({ assessmentId }).select("_id")).map((q) => String(q._id)),
  );
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

/** Student: published assessment + answer-key-stripped questions, or null. */
export async function getStudentAssessment(
  assessmentId: string,
): Promise<{ assessment: AssessmentView; questions: QuestionPublicView[] } | null> {
  const doc = await Assessment.findById(assessmentId).catch(() => null);
  if (!doc || doc.isPublished !== true) return null;
  const questions = await Question.find({ assessmentId }).sort({ order: 1, createdAt: 1 });
  return { assessment: toAssessment(doc), questions: questions.map(toPublicQuestion) };
}

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

/**
 * Grade + persist a student's attempt. Returns null if the assessment isn't
 * published. MCQ auto-graded; open-ended earns marks for a non-empty answer.
 */
export async function submitAttempt(
  assessmentId: string,
  studentId: string,
  answers: { questionId: string; answer: string }[],
): Promise<SubmitResult | null> {
  const assessment = await Assessment.findById(assessmentId).catch(() => null);
  if (!assessment || assessment.isPublished !== true) return null;

  const questions = await Question.find({ assessmentId }).sort({ order: 1 });
  const answerMap = new Map(answers.map((a) => [a.questionId, (a.answer ?? "").trim()]));

  let totalMarks = 0;
  let earnedMarks = 0;
  const review: GradedAnswer[] = [];
  for (const q of questions) {
    const marks = q.marks ?? 1;
    totalMarks += marks;
    const your = answerMap.get(String(q._id)) ?? "";
    let correct = false;
    if (q.type === "mcq") {
      correct = your.length > 0 && your === (q.correctAnswer ?? "").trim();
    } else {
      // open-ended: participation credit for a non-empty response.
      correct = your.length > 0;
    }
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
  const passed = score >= (assessment.passingScore ?? 60);
  const doc = await Attempt.create({
    studentId,
    assessmentId,
    courseId: assessment.courseId,
    answers: answers.map((a) => ({ questionId: a.questionId, answer: a.answer ?? "" })),
    score,
    earnedMarks,
    totalMarks,
    passed,
    submittedAt: new Date().toISOString(),
  });

  return { attempt: toAttempt(doc), review };
}

/** A student's attempts for an assessment, newest first. */
export async function listAttempts(
  assessmentId: string,
  studentId: string,
): Promise<AttemptView[]> {
  const docs = await Attempt.find({ assessmentId, studentId }).sort({ submittedAt: -1 });
  return docs.map(toAttempt);
}

/** Published assessment ids for a course (mandatory assessments for completion). */
export function publishedAssessmentIds(courseId: string): Promise<string[]> {
  return cachedContent(`published-assessments:${courseId}`, async () => {
    const docs = await Assessment.find({ courseId, isPublished: true }).select("_id").lean();
    return docs.map((d) => String(d._id));
  });
}
