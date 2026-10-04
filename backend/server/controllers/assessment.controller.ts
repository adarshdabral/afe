// Assessment controllers. Admin handlers → requireRole("platform_admin");
// student handlers → requireRole("student"). zod validates; 404/409 explicit.

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
  listAttempts,
  listQuestions,
  moduleHasAssessment,
  reorderQuestions,
  setAssessmentPublished,
  submitAttempt,
  updateAssessment,
  updateQuestion,
} from "../services/assessment.service";
import { applyAssessmentResult } from "../services/progress.service";

const idSchema = z.string().min(1);

const createSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(1000).optional(),
});

const updateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    passingScore: z.coerce.number().int().min(0).max(100).optional(),
    estimatedDurationMinutes: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

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
const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), answer: z.string().max(20000) })).max(200),
});

// ---- Admin ----
export async function create(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  if (await moduleHasAssessment(data.moduleId)) {
    res.status(409).json({ error: { message: "This module already has an assessment." } });
    return;
  }
  const a = await createAssessment(data);
  if (!a) {
    res.status(404).json({ error: { message: "Module not found." } });
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
/** GET /api/assessments/:assessmentId — published assessment, no answer key. */
export async function getStudent(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const result = await getStudentAssessment(id);
  if (!result) {
    res.status(404).json({ error: { message: "Assessment not available." } });
    return;
  }
  res.json({ data: result });
}

/** POST /api/assessments/:assessmentId/attempt — grade, persist, update progress. */
export async function attempt(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  const { answers } = submitSchema.parse(req.body);
  const result = await submitAttempt(id, req.user!.id, answers);
  if (!result) {
    res.status(404).json({ error: { message: "Assessment not available." } });
    return;
  }
  // Assessment completion feeds progress (Step 3).
  await applyAssessmentResult(req.user!.id, result.attempt.courseId, {
    assessmentId: id,
    score: result.attempt.score,
    passed: result.attempt.passed,
  });
  res.status(201).json({ data: result });
}

/** GET /api/assessments/:assessmentId/attempts — the student's own attempts. */
export async function myAttempts(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.assessmentId);
  res.json({ data: await listAttempts(id, req.user!.id) });
}
