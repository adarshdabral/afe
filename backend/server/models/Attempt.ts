// Attempt model (Assessment Engine). One row per student quiz submission. Score
// is a percentage; `passed` is score >= the assessment's passingScore.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export interface AttemptAnswer {
  questionId: string;
  answer: string;
}

export interface AttemptView {
  id: string;
  studentId: string;
  assessmentId: string;
  courseId: string;
  answers: AttemptAnswer[];
  score: number; // percentage 0..100
  earnedMarks: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
}

const attemptSchema = new Schema(
  {
    studentId: { type: String, required: true, index: true },
    assessmentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    answers: {
      type: [{ questionId: String, answer: String, _id: false }],
      default: [],
    },
    score: { type: Number, required: true },
    earnedMarks: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    submittedAt: { type: String, required: true },
  },
  { timestamps: true },
);

export type AttemptSchemaType = InferSchemaType<typeof attemptSchema>;
export type AttemptDoc = HydratedDocument<AttemptSchemaType>;

export const Attempt = defineModel("Attempt", attemptSchema);

export function toAttempt(doc: AttemptDoc): AttemptView {
  return {
    id: String(doc._id),
    studentId: doc.studentId,
    assessmentId: doc.assessmentId,
    courseId: doc.courseId,
    answers: (doc.answers ?? []).map((a) => ({ questionId: a.questionId ?? "", answer: a.answer ?? "" })),
    score: doc.score,
    earnedMarks: doc.earnedMarks,
    totalMarks: doc.totalMarks,
    passed: doc.passed === true,
    submittedAt: doc.submittedAt,
  };
}
