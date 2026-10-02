// Topic service (Course CMS). Topics are the learning units inside a Lesson,
// sequenced by `order` within it; new topics go to the end. `moduleId` and
// `courseId` are inherited from the parent lesson. Reordering is scoped to one lesson.

import { Lesson } from "../models/Lesson";
import { Topic, toTopic, type TopicContentType, type TopicView } from "../models/Topic";

export interface CreateTopicInput {
  title: string;
  description?: string;
  contentType: TopicContentType;
  content?: string;
  audioUrl?: string;
  documentUrl?: string;
  videoUrl?: string;
  subtitleUrl?: string;
  estimatedDurationMinutes?: number;
  isPreview?: boolean;
}
export type UpdateTopicInput = Partial<CreateTopicInput>;

const CONTENT_KEYS = ["contentType", "content", "audioUrl", "documentUrl", "videoUrl", "subtitleUrl"] as const;

/** Create a topic at the end of its lesson. Null if the lesson doesn't exist. */
export async function createTopic(lessonId: string, input: CreateTopicInput): Promise<TopicView | null> {
  const lesson = await Lesson.findById(lessonId).catch(() => null);
  if (!lesson) return null;
  const last = await Topic.findOne({ lessonId }).sort({ order: -1 });
  const doc = await Topic.create({
    lessonId,
    moduleId: lesson.moduleId,
    courseId: lesson.courseId,
    title: input.title.trim(),
    description: input.description ?? "",
    order: last ? (last.order ?? 0) + 1 : 0,
    contentType: input.contentType,
    content: input.content ?? "",
    audioUrl: input.audioUrl ?? "",
    documentUrl: input.documentUrl ?? "",
    videoUrl: input.videoUrl ?? "",
    subtitleUrl: input.subtitleUrl ?? "",
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
    isPreview: input.isPreview ?? false,
  });
  return toTopic(doc);
}

export async function updateTopic(topicId: string, patch: UpdateTopicInput): Promise<TopicView | null> {
  const doc = await Topic.findById(topicId).catch(() => null);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.description !== undefined) doc.description = patch.description;
  for (const k of CONTENT_KEYS) if (patch[k] !== undefined) doc.set(k, patch[k]);
  if (patch.estimatedDurationMinutes !== undefined) doc.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  if (patch.isPreview !== undefined) doc.isPreview = patch.isPreview;
  await doc.save();
  return toTopic(doc);
}

export async function deleteTopic(topicId: string): Promise<boolean> {
  const doc = await Topic.findById(topicId).catch(() => null);
  if (!doc) return false;
  await doc.deleteOne();
  return true;
}

/** Persist a new topic order within a lesson. Only ids in the lesson are applied. */
export async function reorderTopics(lessonId: string, orderedIds: string[]): Promise<TopicView[] | null> {
  const lesson = await Lesson.findById(lessonId).catch(() => null);
  if (!lesson) return null;
  const owned = new Set((await Topic.find({ lessonId }).select("_id")).map((t) => String(t._id)));
  let order = 0;
  for (const id of orderedIds) {
    if (!owned.has(id)) continue;
    await Topic.updateOne({ _id: id, lessonId }, { order });
    order += 1;
  }
  const docs = await Topic.find({ lessonId }).sort({ order: 1, createdAt: 1 });
  return docs.map(toTopic);
}
