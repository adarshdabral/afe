// Question model (Assessment Engine). Belongs to one assessment, ordered by
// `order`. `correctAnswer` + `explanation` are answer-key data and are stripped
// from student-facing responses until an attempt is submitted.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import { invalidateOnWrite } from "../cache/content-cache";

export const QUESTION_TYPES = ["mcq", "reflection", "scenario"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Full question (admin view — includes the answer key). */
export interface QuestionView {
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

/** Student-facing question (answer key removed). */
export type QuestionPublicView = Omit<QuestionView, "correctAnswer" | "explanation">;

const questionSchema = new Schema(
  {
    assessmentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: String, default: "" }, // for MCQ; blank for open-ended
    explanation: { type: String, default: "" },
    marks: { type: Number, default: 1, min: 0 },
    order: { type: Number, required: true, default: 0, index: true },
  },
  { timestamps: true },
);

export type QuestionSchemaType = InferSchemaType<typeof questionSchema>;
export type QuestionDoc = HydratedDocument<QuestionSchemaType>;

invalidateOnWrite(questionSchema); // course content is cached (server/cache/content-cache.ts)

export const Question = defineModel("Question", questionSchema);

export function toQuestion(doc: QuestionDoc): QuestionView {
  return {
    id: String(doc._id),
    assessmentId: doc.assessmentId,
    type: doc.type as QuestionType,
    question: doc.question,
    options: doc.options ?? [],
    correctAnswer: doc.correctAnswer ?? "",
    explanation: doc.explanation ?? "",
    marks: doc.marks ?? 1,
    order: doc.order ?? 0,
  };
}

/** Strip the answer key for student consumption. */
export function toPublicQuestion(doc: QuestionDoc): QuestionPublicView {
  const { correctAnswer: _c, explanation: _e, ...rest } = toQuestion(doc);
  void _c;
  void _e;
  return rest;
}
