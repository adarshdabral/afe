// Lesson model (Course CMS). A lesson belongs to exactly one module and is
// sequenced by `order`. `courseId` is denormalized from the parent module so the
// full course tree can be fetched in one query. `content` holds serialized rich
// content (markdown / editor JSON) for rich_text / reflection / case_study types.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export const LESSON_CONTENT_TYPES = [
  "video",
  "pdf",
  "presentation",
  "rich_text",
  "infographic",
  "case_study",
  "reflection",
  "activity",
] as const;
export type LessonContentType = (typeof LESSON_CONTENT_TYPES)[number];

export interface LessonView {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  contentType: LessonContentType;
  videoUrl: string;
  documentUrl: string;
  content: string;
  estimatedDurationMinutes: number;
  isPreview: boolean;
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
    contentType: { type: String, enum: LESSON_CONTENT_TYPES, required: true },
    videoUrl: { type: String, default: "" },
    documentUrl: { type: String, default: "" },
    content: { type: String, default: "" }, // serialized markdown / rich content
    estimatedDurationMinutes: { type: Number, default: 0 },
    isPreview: { type: Boolean, default: false },
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
    contentType: doc.contentType as LessonContentType,
    videoUrl: doc.videoUrl ?? "",
    documentUrl: doc.documentUrl ?? "",
    content: doc.content ?? "",
    estimatedDurationMinutes: doc.estimatedDurationMinutes ?? 0,
    isPreview: doc.isPreview === true,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
