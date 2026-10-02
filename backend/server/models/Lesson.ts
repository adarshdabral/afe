// Lesson model (Course CMS) — a CONTAINER that groups Topics inside a Module:
//   Course → Module → **Lesson** → Topic → content
// A lesson has a name and an optional description; it holds no learning content
// itself (that lives in its Topics). Sequenced by `order` within its module;
// `courseId` is denormalized from the module. Deleting a lesson deletes its topics.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export interface LessonView {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const lessonSchema = new Schema(
  {
    moduleId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    order: { type: Number, required: true, default: 0, index: true },
  },
  { timestamps: true },
);

export type LessonSchemaType = InferSchemaType<typeof lessonSchema>;
export type LessonDoc = HydratedDocument<LessonSchemaType>;

export const Lesson = defineModel("Lesson", lessonSchema);

export function toLesson(doc: LessonDoc): LessonView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    moduleId: doc.moduleId,
    courseId: doc.courseId,
    title: doc.title,
    description: doc.description ?? "",
    order: doc.order ?? 0,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
