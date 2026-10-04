// Topic model (Course CMS) — the actual LEARNING UNIT:
//   Course → Module → Lesson → **Topic** → content (text, audio, PDF/PPT, video + subtitles)
// A topic belongs to exactly one lesson and is sequenced by `order` within it.
// `moduleId` and `courseId` are denormalized from the parent lesson so the course
// tree and the progress sequence can be fetched in one query each. Progress is
// tracked per topic (Progress.completedTopics).

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import { invalidateOnWrite } from "../cache/content-cache";
import { contentFieldsSchema, toContentFields, type ContentFieldsView } from "./content";

export { CONTENT_TYPES as TOPIC_CONTENT_TYPES, type ContentType as TopicContentType } from "./content";

export interface TopicView extends ContentFieldsView {
  id: string;
  lessonId: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationMinutes: number;
  isPreview: boolean;
  createdAt: string;
  updatedAt: string;
}

const topicSchema = new Schema(
  {
    lessonId: { type: String, required: true, index: true },
    moduleId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    order: { type: Number, required: true, default: 0, index: true },
    ...contentFieldsSchema,
    estimatedDurationMinutes: { type: Number, default: 0 },
    isPreview: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Course tree + progress sequence read a whole course sorted by order.
topicSchema.index({ courseId: 1, order: 1 });

export type TopicSchemaType = InferSchemaType<typeof topicSchema>;
export type TopicDoc = HydratedDocument<TopicSchemaType>;

invalidateOnWrite(topicSchema); // course content is cached (server/cache/content-cache.ts)

export const Topic = defineModel("Topic", topicSchema);

export function toTopic(doc: TopicDoc): TopicView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    lessonId: doc.lessonId,
    moduleId: doc.moduleId,
    courseId: doc.courseId,
    title: doc.title,
    description: doc.description ?? "",
    order: doc.order ?? 0,
    ...toContentFields(doc),
    estimatedDurationMinutes: doc.estimatedDurationMinutes ?? 0,
    isPreview: doc.isPreview === true,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
