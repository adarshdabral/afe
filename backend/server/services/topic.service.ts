// Topic service (Course CMS). Topics are the learning units inside a Lesson,
// sequenced by `order` within it; new topics go to the end. `moduleId` and
// `courseId` are inherited from the parent lesson. Reordering is scoped to one lesson.

import { Lesson } from "../models/Lesson";
import { Assessment } from "../models/Assessment";
import { Topic, toTopic, type DiscussionView, type TopicContentType, type TopicView } from "../models/Topic";

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
  allowDownload?: boolean;
  discussion?: Partial<DiscussionView>;
  /** Visible to students (drafts are admin-only). Default true. */
  isPublished?: boolean;
  gradeCategory?: string;
  contentStatus?: "complete" | "needs_content";
  adminNote?: string;
  /** Explicit position (imports); default = after the lesson's last item. */
  order?: number;
  importKey?: string | null;
}
export type UpdateTopicInput = Partial<CreateTopicInput>;

const CONTENT_KEYS = ["contentType", "content", "audioUrl", "documentUrl", "videoUrl", "subtitleUrl"] as const;

function normalizeDiscussion(d: Partial<DiscussionView> | undefined): DiscussionView {
  return {
    prompt: d?.prompt?.trim() ?? "",
    instructions: d?.instructions?.trim() ?? "",
    questions: (d?.questions ?? []).map((q) => q.trim()).filter(Boolean),
    relatedTopicId: d?.relatedTopicId || null,
    required: d?.required === true,
  };
}

/** Create a topic at the end of its lesson. Null if the lesson doesn't exist. */
export async function createTopic(lessonId: string, input: CreateTopicInput): Promise<TopicView | null> {
  const lesson = await Lesson.findById(lessonId).catch(() => null);
  if (!lesson) return null;
  const doc = await Topic.create({
    lessonId,
    moduleId: lesson.moduleId,
    courseId: lesson.courseId,
    title: input.title.trim(),
    description: input.description ?? "",
    order: input.order ?? (await nextLessonPosition(lessonId)),
    contentType: input.contentType,
    content: input.content ?? "",
    audioUrl: input.audioUrl ?? "",
    documentUrl: input.documentUrl ?? "",
    videoUrl: input.videoUrl ?? "",
    subtitleUrl: input.subtitleUrl ?? "",
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
    isPreview: input.isPreview ?? false,
    allowDownload: input.allowDownload ?? true,
    discussion: normalizeDiscussion(input.discussion),
    isPublished: input.isPublished ?? true,
    gradeCategory: input.gradeCategory ?? "",
    contentStatus: input.contentStatus ?? "complete",
    adminNote: input.adminNote ?? "",
    importKey: input.importKey ?? null,
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
  if (patch.allowDownload !== undefined) doc.allowDownload = patch.allowDownload;
  if (patch.isPublished !== undefined) doc.isPublished = patch.isPublished;
  if (patch.gradeCategory !== undefined) doc.gradeCategory = patch.gradeCategory;
  if (patch.contentStatus !== undefined) doc.contentStatus = patch.contentStatus;
  if (patch.adminNote !== undefined) doc.adminNote = patch.adminNote;
  if (patch.discussion !== undefined) {
    doc.set("discussion", normalizeDiscussion({ ...toTopic(doc).discussion, ...patch.discussion }));
  }
  await doc.save();
  return toTopic(doc);
}

export async function deleteTopic(topicId: string): Promise<boolean> {
  const doc = await Topic.findById(topicId).catch(() => null);
  if (!doc) return false;
  await doc.deleteOne();
  return true;
}

/** The next free position in a lesson — after its last topic AND assignment. */
export async function nextLessonPosition(lessonId: string): Promise<number> {
  const [t, a] = await Promise.all([
    Topic.findOne({ lessonId }).sort({ order: -1 }).select("order").lean(),
    Assessment.findOne({ lessonId, kind: "lesson", order: { $type: "number" } }).sort({ order: -1 }).select("order").lean(),
  ]);
  const max = Math.max(t?.order ?? -1, typeof a?.order === "number" ? a.order : -1);
  return max + 1;
}

/**
 * Persist a new topic order within a lesson. Only ids in the lesson are applied.
 * The topics keep the same set of positions they occupied, so assignments placed
 * between topics stay where they are.
 */
export async function reorderTopics(lessonId: string, orderedIds: string[]): Promise<TopicView[] | null> {
  const lesson = await Lesson.findById(lessonId).catch(() => null);
  if (!lesson) return null;
  const topics = await Topic.find({ lessonId }).select("_id order").lean();
  const owned = new Set(topics.map((t) => String(t._id)));
  const slots = topics.map((t) => t.order ?? 0).sort((a, b) => a - b);
  const ids = orderedIds.filter((id) => owned.has(id));
  for (const id of topics.map((t) => String(t._id))) if (!ids.includes(id)) ids.push(id); // keep unlisted
  for (let i = 0; i < ids.length; i++) {
    await Topic.updateOne({ _id: ids[i], lessonId }, { order: slots[i] ?? i });
  }
  const docs = await Topic.find({ lessonId }).sort({ order: 1, createdAt: 1 });
  return docs.map(toTopic);
}

/**
 * Persist the combined order of a lesson's topics AND assignments (positions 0..n).
 * Items that don't belong to the lesson are ignored; missing ones keep their order after.
 */
export async function reorderLessonItems(
  lessonId: string,
  items: { kind: "topic" | "assignment"; id: string }[],
): Promise<boolean> {
  const lesson = await Lesson.findById(lessonId).catch(() => null);
  if (!lesson) return false;
  const [topics, assignments] = await Promise.all([
    Topic.find({ lessonId }).select("_id").lean(),
    Assessment.find({ lessonId, kind: "lesson" }).select("_id").lean(),
  ]);
  const topicIds = new Set(topics.map((t) => String(t._id)));
  const assignmentIds = new Set(assignments.map((a) => String(a._id)));
  let order = 0;
  for (const it of items) {
    if (it.kind === "topic" && topicIds.has(it.id)) await Topic.updateOne({ _id: it.id, lessonId }, { order: order++ });
    else if (it.kind === "assignment" && assignmentIds.has(it.id)) await Assessment.updateOne({ _id: it.id, lessonId }, { order: order++ });
  }
  return true;
}
