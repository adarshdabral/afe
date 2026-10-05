// Attempt model (Assessment Engine). One row per student attempt at an assessment
// or lesson assignment. An attempt is either:
//   in_progress — started (POST …/start); holds the server-side `deadline` for timed
//                 attempts, the autosaved `draftAnswers` and the per-attempt question
//                 / option order (shuffling).
//   submitted   — graded: score is a percentage, `passed` is score >= passingScore
//                 (always true for non-graded assignments once submitted).
// Rows created before `status` existed are submitted attempts.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export const ATTEMPT_STATUSES = ["in_progress", "submitted"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
/** Mongo filter for submitted attempts (legacy rows have no `status`). */
export const SUBMITTED = { status: { $ne: "in_progress" } } as const;

export interface AttemptAnswer {
  questionId: string;
  answer: string;
}

export interface AttemptView {
  id: string;
  studentId: string;
  assessmentId: string;
  courseId: string;
  status: AttemptStatus;
  answers: AttemptAnswer[];
  score: number; // percentage 0..100
  earnedMarks: number;
  totalMarks: number;
  passed: boolean;
  startedAt: string | null;
  /** Server deadline for timed attempts (null = untimed). */
  deadline: string | null;
  /** Submitted by the server when the time ran out (saved answers were graded). */
  autoSubmitted: boolean;
  submittedAt: string;
}

const answerSchema = { type: [{ questionId: String, answer: String, _id: false }], default: [] };

const attemptSchema = new Schema(
  {
    studentId: { type: String, required: true, index: true },
    assessmentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    status: { type: String, enum: ATTEMPT_STATUSES, default: "submitted" },
    answers: answerSchema,
    draftAnswers: answerSchema,
    questionOrder: { type: [String], default: [] },
    optionOrders: { type: [{ questionId: String, options: [String], _id: false }], default: [] },
    score: { type: Number, default: 0 },
    earnedMarks: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    deadline: { type: Date, default: null },
    autoSubmitted: { type: Boolean, default: false },
    submittedAt: { type: String, default: "" },
  },
  { timestamps: true },
);
// At most ONE in-progress attempt per student per assessment.
attemptSchema.index(
  { studentId: 1, assessmentId: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" }, name: "one_active_attempt" },
);
// Expired-attempt sweeps look up a student's in-progress attempts by deadline.
attemptSchema.index({ studentId: 1, status: 1, deadline: 1 });

export type AttemptSchemaType = InferSchemaType<typeof attemptSchema>;
export type AttemptDoc = HydratedDocument<AttemptSchemaType>;

export const Attempt = defineModel("Attempt", attemptSchema);

export function toAttempt(doc: AttemptDoc): AttemptView {
  return {
    id: String(doc._id),
    studentId: doc.studentId,
    assessmentId: doc.assessmentId,
    courseId: doc.courseId,
    status: (doc.status as AttemptStatus) ?? "submitted",
    answers: (doc.answers ?? []).map((a) => ({ questionId: a.questionId ?? "", answer: a.answer ?? "" })),
    score: doc.score ?? 0,
    earnedMarks: doc.earnedMarks ?? 0,
    totalMarks: doc.totalMarks ?? 0,
    passed: doc.passed === true,
    startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : null,
    deadline: doc.deadline ? new Date(doc.deadline).toISOString() : null,
    autoSubmitted: doc.autoSubmitted === true,
    submittedAt: doc.submittedAt ?? "",
  };
}
