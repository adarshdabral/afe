// Assessment model (Assessment Engine). Optionally one per module (unique
// moduleId). Passing score defaults to 60%. Questions live in the Question model.
// Only platform admins create/edit/publish; students attempt when published.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export const DEFAULT_PASSING_SCORE = 60;

export interface AssessmentView {
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

const assessmentSchema = new Schema(
  {
    moduleId: { type: String, required: true, unique: true, index: true },
    courseId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    passingScore: { type: Number, default: DEFAULT_PASSING_SCORE, min: 0, max: 100 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type AssessmentSchemaType = InferSchemaType<typeof assessmentSchema>;
export type AssessmentDoc = HydratedDocument<AssessmentSchemaType>;

export const Assessment = defineModel("Assessment", assessmentSchema);

export function toAssessment(doc: AssessmentDoc): AssessmentView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    moduleId: doc.moduleId,
    courseId: doc.courseId,
    title: doc.title,
    description: doc.description ?? "",
    passingScore: doc.passingScore ?? DEFAULT_PASSING_SCORE,
    isPublished: doc.isPublished === true,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
