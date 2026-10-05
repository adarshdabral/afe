// Frontend Assessment Engine service — the only place axios is called for
// assessments. Mirrors backend/server/services/assessment.service.ts. One model for
// module assessments (kind "module") and lesson assignments (kind "lesson").

import { api } from "./axios";

export const QUESTION_TYPES = ["mcq", "reflection", "scenario"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type AssessmentKind = "module" | "lesson";

export interface Assessment {
  id: string;
  kind: AssessmentKind;
  moduleId: string;
  lessonId: string | null;
  courseId: string;
  title: string;
  description: string;
  instructions: string;
  /** Graded → must reach passingScore. Non-graded → submitting completes it. */
  isGraded: boolean;
  /** Lesson assignments: required for the lesson to count as complete. */
  isRequired: boolean;
  passingScore: number;
  /** Expected minutes to complete (0 = not estimated). */
  estimatedDurationMinutes: number;
  /** Countdown per attempt in minutes (0 = untimed) — enforced by the server. */
  timeLimitMinutes: number;
  /** 0 = unlimited. */
  maxAttempts: number;
  availableFrom: string | null;
  availableUntil: string | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  autoSubmitOnTimeout: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The configuration fields shared by assessments and assignments (admin form). */
export type AssessmentConfig = Pick<
  Assessment,
  | "title"
  | "description"
  | "instructions"
  | "isGraded"
  | "isRequired"
  | "passingScore"
  | "estimatedDurationMinutes"
  | "timeLimitMinutes"
  | "maxAttempts"
  | "availableFrom"
  | "availableUntil"
  | "shuffleQuestions"
  | "shuffleOptions"
  | "autoSubmitOnTimeout"
>;

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
  status: "in_progress" | "submitted";
  answers: { questionId: string; answer: string }[];
  score: number;
  earnedMarks: number;
  totalMarks: number;
  passed: boolean;
  startedAt: string | null;
  deadline: string | null;
  autoSubmitted: boolean;
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

/** The student's standing on an assessment (from the server). */
export interface AttemptState {
  submittedAttempts: number;
  maxAttempts: number;
  attemptsRemaining: number | null;
  best: { score: number; passed: boolean } | null;
  active: { id: string; startedAt: string | null; deadline: string | null; answers: { questionId: string; answer: string }[] } | null;
  available: boolean;
  availabilityMessage: string | null;
  serverNow: string;
}

export interface StudentAssessment {
  assessment: Assessment;
  /** Empty for a timed assessment until an attempt is started. */
  questions: PublicQuestion[];
  state: AttemptState;
}

export interface SubmitResult {
  attempt: Attempt;
  review: GradedAnswer[];
}

export type CreateAssessmentInput = Partial<AssessmentConfig> & { title: string } & (
    | { moduleId: string; lessonId?: never }
    | { lessonId: string; moduleId?: never }
  );

export interface CreateQuestionInput {
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  marks?: number;
}

const ADMIN = "/admin/assessments";
type Bundle = { assessment: Assessment | null; questions: Question[] };

// ---- Admin ----
export async function getModuleAssessment(moduleId: string): Promise<Bundle> {
  const { data } = await api.get<{ data: Bundle }>(`${ADMIN}/module/${moduleId}`);
  return data.data;
}
export async function getLessonAssignment(lessonId: string): Promise<Bundle> {
  const { data } = await api.get<{ data: Bundle }>(`${ADMIN}/lesson/${lessonId}`);
  return data.data;
}
export async function createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
  const { data } = await api.post<{ data: Assessment }>(ADMIN, input);
  return data.data;
}
export async function updateAssessment(id: string, patch: Partial<AssessmentConfig>): Promise<Assessment> {
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
export async function addQuestion(assessmentId: string, input: CreateQuestionInput): Promise<Question> {
  const { data } = await api.post<{ data: Question }>(`${ADMIN}/${assessmentId}/questions`, input);
  return data.data;
}
export async function updateQuestion(questionId: string, patch: Partial<CreateQuestionInput>): Promise<Question> {
  const { data } = await api.patch<{ data: Question }>(`${ADMIN}/questions/${questionId}`, patch);
  return data.data;
}
export async function deleteQuestion(questionId: string): Promise<void> {
  await api.delete(`${ADMIN}/questions/${questionId}`);
}
export async function reorderQuestions(assessmentId: string, orderedIds: string[]): Promise<Question[]> {
  const { data } = await api.post<{ data: Question[] }>(`${ADMIN}/${assessmentId}/questions/reorder`, { orderedIds });
  return data.data;
}

// ---- Student ----
/** The assessment + the student's attempt state (403 with a message when locked). */
export async function getAssessment(assessmentId: string): Promise<StudentAssessment> {
  const { data } = await api.get<{ data: StudentAssessment }>(`/assessments/${assessmentId}`);
  return data.data;
}
/** Start or resume an attempt — the server sets the deadline for timed ones. */
export async function startAttempt(assessmentId: string): Promise<StudentAssessment> {
  const { data } = await api.post<{ data: StudentAssessment }>(`/assessments/${assessmentId}/start`);
  return data.data;
}
/** Autosave answers to the in-progress attempt (409 once its time is up). */
export async function saveAnswers(
  assessmentId: string,
  attemptId: string,
  answers: { questionId: string; answer: string }[],
): Promise<{ savedAt: string; deadline: string | null }> {
  const { data } = await api.put<{ data: { savedAt: string; deadline: string | null } }>(
    `/assessments/${assessmentId}/attempts/${attemptId}`,
    { answers },
  );
  return data.data;
}
/** Submit. A 409 after the deadline still carries the auto-submitted result in
 *  `error.response.data.data` (see submitResultFromError). */
export async function submitAttempt(
  assessmentId: string,
  answers: { questionId: string; answer: string }[],
): Promise<SubmitResult> {
  const { data } = await api.post<{ data: SubmitResult }>(`/assessments/${assessmentId}/attempt`, { answers });
  return data.data;
}
/** The result the server submitted on the student's behalf (time up), if any. */
export function submitResultFromError(err: unknown): SubmitResult | null {
  const d = (err as { response?: { data?: { data?: SubmitResult } } })?.response?.data?.data;
  return d?.attempt ? d : null;
}
export async function myAttempts(assessmentId: string): Promise<Attempt[]> {
  const { data } = await api.get<{ data: Attempt[] }>(`/assessments/${assessmentId}/attempts`);
  return data.data;
}
