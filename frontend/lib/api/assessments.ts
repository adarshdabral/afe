// Frontend Assessment Engine service — the only place axios is called for
// assessments. Mirrors backend/server/services/assessment.service.ts.

import { api } from "./axios";

export const QUESTION_TYPES = ["mcq", "reflection", "scenario"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface Assessment {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  passingScore: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  assessmentId: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  marks: number;
  order: number;
}

/** Student-facing question (answer key removed by the API). */
export type PublicQuestion = Omit<Question, "correctAnswer" | "explanation">;

export interface Attempt {
  id: string;
  studentId: string;
  assessmentId: string;
  courseId: string;
  answers: { questionId: string; answer: string }[];
  score: number;
  earnedMarks: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
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

export interface CreateAssessmentInput {
  moduleId: string;
  title: string;
  description?: string;
  passingScore?: number;
}
export interface CreateQuestionInput {
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  marks?: number;
}

const ADMIN = "/admin/assessments";

// ---- Admin ----
export async function getModuleAssessment(
  moduleId: string,
): Promise<{ assessment: Assessment | null; questions: Question[] }> {
  const { data } = await api.get<{ data: { assessment: Assessment | null; questions: Question[] } }>(
    `${ADMIN}/module/${moduleId}`,
  );
  return data.data;
}
export async function createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
  const { data } = await api.post<{ data: Assessment }>(ADMIN, input);
  return data.data;
}
export async function updateAssessment(
  id: string,
  patch: Partial<Pick<Assessment, "title" | "description" | "passingScore">>,
): Promise<Assessment> {
  const { data } = await api.patch<{ data: Assessment }>(`${ADMIN}/${id}`, patch);
  return data.data;
}
export async function publishAssessment(id: string): Promise<Assessment> {
  const { data } = await api.post<{ data: Assessment }>(`${ADMIN}/${id}/publish`);
  return data.data;
}
export async function unpublishAssessment(id: string): Promise<Assessment> {
  const { data } = await api.post<{ data: Assessment }>(`${ADMIN}/${id}/unpublish`);
  return data.data;
}
export async function deleteAssessment(id: string): Promise<void> {
  await api.delete(`${ADMIN}/${id}`);
}
export async function addQuestion(
  assessmentId: string,
  input: CreateQuestionInput,
): Promise<Question> {
  const { data } = await api.post<{ data: Question }>(`${ADMIN}/${assessmentId}/questions`, input);
  return data.data;
}
export async function updateQuestion(
  questionId: string,
  patch: Partial<CreateQuestionInput>,
): Promise<Question> {
  const { data } = await api.patch<{ data: Question }>(`${ADMIN}/questions/${questionId}`, patch);
  return data.data;
}
export async function deleteQuestion(questionId: string): Promise<void> {
  await api.delete(`${ADMIN}/questions/${questionId}`);
}

// ---- Student ----
export async function getAssessment(
  assessmentId: string,
): Promise<{ assessment: Assessment; questions: PublicQuestion[] }> {
  const { data } = await api.get<{ data: { assessment: Assessment; questions: PublicQuestion[] } }>(
    `/assessments/${assessmentId}`,
  );
  return data.data;
}
export async function submitAttempt(
  assessmentId: string,
  answers: { questionId: string; answer: string }[],
): Promise<{ attempt: Attempt; review: GradedAnswer[] }> {
  const { data } = await api.post<{ data: { attempt: Attempt; review: GradedAnswer[] } }>(
    `/assessments/${assessmentId}/attempt`,
    { answers },
  );
  return data.data;
}
export async function myAttempts(assessmentId: string): Promise<Attempt[]> {
  const { data } = await api.get<{ data: Attempt[] }>(`/assessments/${assessmentId}/attempts`);
  return data.data;
}
