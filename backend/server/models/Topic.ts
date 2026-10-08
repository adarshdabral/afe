// Topic model (Course CMS) — the actual LEARNING UNIT:
//   Course → Module → Lesson → **Topic** → content (text, audio, PDF/PPT, video + subtitles)
// A topic belongs to exactly one lesson and is sequenced by `order` within it.
// `moduleId` and `courseId` are denormalized from the parent lesson so the course
// tree and the progress sequence can be fetched in one query each. Progress is
// tracked per topic (Progress.completedTopics).

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import { importFieldsSchema, indexImportKey, toImportFields, type ImportFieldsView } from "./importFields";
import { invalidateOnWrite } from "../cache/content-cache";
import { contentFieldsSchema, toContentFields, type ContentFieldsView } from "./content";

export { CONTENT_TYPES as TOPIC_CONTENT_TYPES, type ContentType as TopicContentType } from "./content";

/** Settings of a "discussion" topic. Participation happens in its linked forum thread. */
export interface DiscussionView {
  prompt: string;
  instructions: string;
  /** Optional guiding questions. */
  questions: string[];
  /** Another topic this discussion is about (optional). */
  relatedTopicId: string | null;
  /** The student must post in the thread before the topic can be completed. */
  required: boolean;
}

export const EMPTY_DISCUSSION: DiscussionView = { prompt: "", instructions: "", questions: [], relatedTopicId: null, required: false };

export interface TopicView extends ContentFieldsView, ImportFieldsView {
  id: string;
  lessonId: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationMinutes: number;
  isPreview: boolean;
  /** Students may download this topic's text/media (admin-controlled; default on). */
  allowDownload: boolean;
  /** True when the topic has a video (kept even when media URLs are withheld). */
  hasVideo: boolean;
  discussion: DiscussionView;
  /** Shown to students (and part of their learning sequence). Drafts are admin-only. */
  isPublished: boolean;
  /** Grading category this item counts towards (Course.gradingWeights; admin-only). */
  gradeCategory: string;
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
    allowDownload: { type: Boolean, default: true }, // admins can switch it off per topic
    isPublished: { type: Boolean, default: true }, // existing topics stay visible
    gradeCategory: { type: String, default: "" },
    ...importFieldsSchema,
    discussion: {
      prompt: { type: String, default: "" },
      instructions: { type: String, default: "" },
      questions: { type: [String], default: [] },
      relatedTopicId: { type: String, default: null },
      required: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

// Course tree + progress sequence read a whole course sorted by order.
topicSchema.index({ courseId: 1, order: 1 });

indexImportKey(topicSchema);

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
    allowDownload: doc.allowDownload !== false,
    isPublished: doc.isPublished !== false,
    gradeCategory: doc.gradeCategory ?? "",
    ...toImportFields(doc),
    hasVideo: !!doc.videoUrl,
    discussion: {
      prompt: doc.discussion?.prompt ?? "",
      instructions: doc.discussion?.instructions ?? "",
      questions: [...(doc.discussion?.questions ?? [])],
      relatedTopicId: doc.discussion?.relatedTopicId ?? null,
      required: doc.discussion?.required === true,
    },
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
