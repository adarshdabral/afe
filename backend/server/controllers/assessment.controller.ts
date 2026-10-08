// Assessment controllers — module assessments AND lesson assignments (same model,
// same configuration). Admin handlers → platform_admin; student handlers check the
// learning sequence first (a locked item → 403) and merge any results the server
// auto-submitted (timer expiry) into progress. zod validates; 404/409 explicit.

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import { QUESTION_TYPES } from "../models/Question";
import {
  addQuestion,
  createAssessment,
  deleteAssessment,
  deleteQuestion,
  getAssessment,
  getAssessmentForModule,
  getStudentAssessment,
  getAssignmentsForLesson,
  listAttempts,
  listQuestions,
  moduleHasAssessment,
  publishedAssessmentCourse,
  reorderQuestions,
  saveDraft,
  setAssessmentPublished,
  startAttempt,
  submitAttempt,
  updateAssessment,
  updateQuestion,
} from "../services/assessment.service";
import { applyAssessmentResult, checkItemAccess } from "../services/progress.service";
import { HttpError } from "../http/errors";

const idSchema = z.string().min(1);
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date.")
  .nullable()
  .optional();

/** The unified configuration shared by module assessments and lesson assignments. */
const configFields = {
  description: z.string().max(5000).optional(),
  instructions: z.string().max(20000).optional(),
  isGraded: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(1000).optional(),
  timeLimitMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  maxAttempts: z.coerce.number().int().min(0).max(100).optional(),
  availableFrom: isoDate,
  availableUntil: isoDate,
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  autoSubmitOnTimeout: z.boolean().optional(),
  order: z.coerce.number().min(0).max(100000).nullable().optional(),
  gradeCategory: z.string().max(120).optional(),
  contentStatus: z.enum(["complete", "needs_content"]).optional(),
  adminNote: z.string().max(5000).optional(),
};

const windowOk = (v: { availableFrom?: string | null; availableUntil?: string | null }) =>
  !v.availableFrom || !v.availableUntil || Date.parse(v.availableFrom) < Date.parse(v.availableUntil);
const windowMsg = { message: "availableUntil must be after availableFrom." };

const createSchema = z
  .object({
    moduleId: z.string().min(1).optional(),
    lessonId: z.string().min(1).optional(),
    title: z.string().min(1).max(200),
    ...configFields,
  })
  .refine((v) => !!v.moduleId !== !!v.lessonId, { message: "Give exactly one of moduleId (module assessment) or lessonId (lesson assignment)." })
  .refine(windowOk, windowMsg);

const updateSchema = z
  .object({ title: z.string().min(1).max(200).optional(), ...configFields })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." })
  .refine(windowOk, windowMsg);

const questionSchema = {
  type: z.enum(QUESTION_TYPES),
  question: z.string().min(1).max(5000),
  options: z.array(z.string().max(1000)).max(10).optional(),
  correctAnswer: z.string().max(1000).optional(),
  explanation: z.string().max(5000).optional(),
  marks: z.coerce.number().int().min(0).max(100).optional(),
};
const createQuestionSchema = z.object(questionSchema);
const updateQuestionSchema = z
  .object({
    type: questionSchema.type.optional(),
    question: questionSchema.question.optional(),
    options: questionSchema.options,
    correctAnswer: questionSchema.correctAnswer,
    explanation: questionSchema.explanation,
    marks: questionSchema.marks,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });
const answersSchema = z.array(z.object({ questionId: z.string().min(1), answer: z.string().max(20000) })).max(200);
const submitSchema = z.object({ answers: answersSchema });

// ---- Admin ----
export async function create(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  // A module has at most one module assessment; lessons may have several assignments.
  if (!data.lessonId && (await moduleHasAssessment(data.moduleId!))) {
    res.status(409).json({ error: { message: "This module already has an assessment." } });
    return;
  }
  const a = await createAssessment(data);
  if (!a) {
    res.status(404).json({ error: { message: data.lessonId ? "Lesson not found." : "Module not found." } });
    return;
  }
  res.status(201).json({ data: a });
}

/** GET /api/admin/assessments/module/:moduleId — {assessment|null, questions}. */
export async function getForModule(req: Request, res: Response): Promise<void> {
  const moduleId = idSchema.parse(req.params.moduleId);
  const assessment = await getAssessmentForModule(moduleId);
  const questions = assessment ? await listQuestions(assessment.id) : [];
  res.json({ data: { assessment, questions } });
}

/** GET /api/admin/assessments/lesson/:lessonId — the lesson's assignments, in order:
 *  { assessment (the first, back-compat), questions (its questions), assignments: [{assessment, questions}] }. */
export async function getForLesson(req: Request, res: Response): Promise<void> {
  const lessonId = idSchema.parse(req.params.lessonId);
  const all = await getAssignmentsForLesson(lessonId);
  const assignments = await Promise.all(all.map(async (a) => ({ assessment: a, questions: await listQuestions(a.id) })));
  res.json({ data: { assessment: assignments[0]?.assessment ?? null, questions: assignments[0]?.questions ?? [], assignments } });
}

/** GET /api/admin/assessments/:assessmentId — full (answer key included). */
export async function getAdmin(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const assessment = await getAssessment(id);
  if (!assessment) {
    res.status(404).json({ error: { message: "Assessment not found." } });
    return;
  }
  res.json({ data: { assessment, questions: await listQuestions(id) } });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const a = await updateAssessment(id, updateSchema.parse(req.body));
  if (!a) {
    res.status(404).json({ error: { message: "Assessment not found." } });
    return;
  }
  res.json({ data: a });
}

function publishHandler(isPublished: boolean) {
  return async (req: Request, res: Response): Promise<void> => {
    const id = idSchema.parse(req.params.assessmentId);
    const a = await setAssessmentPublished(id, isPublished);
    if (!a) {
      res.status(404).json({ error: { message: "Assessment not found." } });
      return;
    }
    res.json({ data: a });
  };
}
export const publish = publishHandler(true);
export const unpublish = publishHandler(false);

export async function remove(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const ok = await deleteAssessment(id);
  if (!ok) {
    res.status(404).json({ error: { message: "Assessment not found." } });
    return;
  }
  res.json({ data: { ok: true } });
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const q = await addQuestion(id, createQuestionSchema.parse(req.body));
  if (!q) {
    res.status(404).json({ error: { message: "Assessment not found." } });
    return;
  }
  res.status(201).json({ data: q });
}

export async function editQuestion(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.questionId);
  const q = await updateQuestion(id, updateQuestionSchema.parse(req.body));
  if (!q) {
    res.status(404).json({ error: { message: "Question not found." } });
    return;
  }
  res.json({ data: q });
}

export async function removeQuestion(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.questionId);
  const ok = await deleteQuestion(id);
  if (!ok) {
    res.status(404).json({ error: { message: "Question not found." } });
    return;
  }
  res.json({ data: { ok: true } });
}

export async function reorder(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const { orderedIds } = reorderSchema.parse(req.body);
  const qs = await reorderQuestions(id, orderedIds);
  if (!qs) {
    res.status(404).json({ error: { message: "Assessment not found." } });
    return;
  }
  res.json({ data: qs });
}

// ---- Student ----

/** Students: the assessment must be published AND unlocked in their sequence. Returns its course. */
async function assertStudentAccess(assessmentId: string, studentId: string): Promise<string> {
  const courseId = await publishedAssessmentCourse(assessmentId);
  if (!courseId) throw new HttpError(404, "Assessment not available.");
  const access = await checkItemAccess(studentId, courseId, assessmentId);
  if (!access.ok) throw new HttpError(access.reason === "locked" ? 403 : 404, access.message);
  return courseId;
}

type Expired = { assessmentId: string; score: number; passed: boolean }[];
/** Merge results the server auto-submitted (timer expiry) into the student's progress. */
async function applyExpired(studentId: string, courseId: string, expired: Expired): Promise<void> {
  for (const r of expired) await applyAssessmentResult(studentId, courseId, r);
}

/** GET /api/assessments/:assessmentId — published assessment (no answer keys) + the
 *  student's attempt state. Staff get a preview (questions, no attempt state). */
export async function getStudent(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const isStudent = req.user!.role === "student";
  const courseId = isStudent ? await assertStudentAccess(id, req.user!.id) : null;
  const { value, expired } = await getStudentAssessment(id, isStudent ? req.user!.id : null);
  if (courseId) await applyExpired(req.user!.id, courseId, expired);
  res.json({ data: value });
}

/** POST /api/assessments/:assessmentId/start — start (or resume) an attempt; sets the server deadline. */
export async function start(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const courseId = await assertStudentAccess(id, req.user!.id);
  const { value, expired } = await startAttempt(id, req.user!.id);
  await applyExpired(req.user!.id, courseId, expired);
  res.status(201).json({ data: value });
}

/** PUT /api/assessments/:assessmentId/attempts/:attemptId — autosave draft answers. */
export async function saveAnswers(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const attemptId = idSchema.parse(req.params.attemptId);
  const { answers } = submitSchema.parse(req.body);
  const courseId = await assertStudentAccess(id, req.user!.id);
  const outcome = await saveDraft(id, attemptId, req.user!.id, answers);
  if (!outcome.ok) {
    await applyExpired(req.user!.id, courseId, outcome.expired);
    res.status(outcome.status).json({ error: { message: outcome.message } });
    return;
  }
  res.json({ data: { savedAt: outcome.savedAt, deadline: outcome.deadline } });
}

/** POST /api/assessments/:assessmentId/attempt — grade, persist, update progress. */
export async function attempt(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const { answers } = submitSchema.parse(req.body);
  const courseId = await assertStudentAccess(id, req.user!.id);
  const outcome = await submitAttempt(id, req.user!.id, answers);
  const result = outcome.result;
  // Completion feeds progress — including an attempt the server just auto-submitted.
  if (result) {
    await applyAssessmentResult(req.user!.id, courseId, {
      assessmentId: id,
      score: result.attempt.score,
      passed: result.attempt.passed,
    });
  }
  if (!outcome.ok) {
    res.status(outcome.status).json({ error: { message: outcome.message }, ...(outcome.result ? { data: outcome.result } : {}) });
    return;
  }
  res.status(201).json({ data: outcome.result });
}

/** GET /api/assessments/:assessmentId/attempts — the student's own submitted attempts. */
export async function myAttempts(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  res.json({ data: await listAttempts(id, req.user!.id) });
}
