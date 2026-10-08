// Topic controllers (Course CMS) — the learning units inside a Lesson. All mounted
// behind requireRole("platform_admin").

import { z } from "zod";
import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { TOPIC_CONTENT_TYPES } from "../models/Topic";
import { createTopic, deleteTopic, reorderLessonItems, reorderTopics, updateTopic } from "../services/topic.service";
import { contentFields, idSchema, reorderSchema } from "./content.schema";
import { ensureDiscussionThread, hideDiscussionThread } from "../services/forum.service";
import { getUserById } from "../services/auth.service";
import type { TopicView } from "../models/Topic";

/** Keep a discussion topic's forum thread in sync (create/update, or hide it when the
 *  topic stops being a discussion). */
async function syncDiscussion(req: Request, topic: TopicView): Promise<void> {
  if (topic.contentType !== "discussion") {
    await hideDiscussionThread(topic.id);
    return;
  }
  const user = await getUserById(req.user!.id);
  await ensureDiscussionThread(topic, { id: req.user!.id, name: user?.name ?? "Course team", role: req.user!.role });
}

const base = {
  description: z.string().max(5000).optional(),
  ...contentFields,
  isPreview: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  gradeCategory: z.string().max(120).optional(),
  contentStatus: z.enum(["complete", "needs_content"]).optional(),
  adminNote: z.string().max(5000).optional(),
  discussion: z
    .object({
      prompt: z.string().max(5000).optional(),
      instructions: z.string().max(10000).optional(),
      questions: z.array(z.string().max(1000)).max(20).optional(),
      relatedTopicId: z.string().max(100).nullable().optional(),
      required: z.boolean().optional(),
    })
    .optional(),
};

const createSchema = z.object({
  title: z.string().min(1).max(200),
  ...base,
  contentType: z.enum(TOPIC_CONTENT_TYPES),
});

const updateSchema = z
  .object({ title: z.string().min(1).max(200).optional(), ...base })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

/** POST /api/admin/courses/lessons/:lessonId/topics */
export async function create(req: Request, res: Response): Promise<void> {
  const lessonId = idSchema.parse(req.params.lessonId);
  const topic = await createTopic(lessonId, createSchema.parse(req.body));
  if (!topic) {
    res.status(404).json({ error: { message: "Lesson not found." } });
    return;
  }
  await syncDiscussion(req, topic);
  res.status(201).json({ data: topic });
}

/** PATCH /api/admin/courses/topics/:topicId */
export async function update(req: Request, res: Response): Promise<void> {
  const topicId = idSchema.parse(req.params.topicId);
  const topic = await updateTopic(topicId, updateSchema.parse(req.body));
  if (!topic) {
    res.status(404).json({ error: { message: "Topic not found." } });
    return;
  }
  await syncDiscussion(req, topic);
  res.json({ data: topic });
}

/** DELETE /api/admin/courses/topics/:topicId */
export async function remove(req: Request, res: Response): Promise<void> {
  const topicId = idSchema.parse(req.params.topicId);
  const ok = await deleteTopic(topicId);
  if (ok) await hideDiscussionThread(topicId);
  if (!ok) {
    res.status(404).json({ error: { message: "Topic not found." } });
    return;
  }
  res.json({ data: { ok: true } });
}

/** POST /api/admin/courses/lessons/:lessonId/topics/reorder */
export async function reorder(req: Request, res: Response): Promise<void> {
  const lessonId = idSchema.parse(req.params.lessonId);
  const { orderedIds } = reorderSchema.parse(req.body);
  const topics = await reorderTopics(lessonId, orderedIds);
  if (!topics) {
    res.status(404).json({ error: { message: "Lesson not found." } });
    return;
  }
  res.json({ data: topics });
}

const itemsSchema = z.object({
  items: z.array(z.object({ kind: z.enum(["topic", "assignment"]), id: z.string().min(1) })).min(1).max(500),
});

/** POST /api/admin/courses/lessons/:lessonId/items/reorder — combined topic + assignment order. */
export async function reorderItems(req: Request, res: Response): Promise<void> {
  const lessonId = idSchema.parse(req.params.lessonId);
  const { items } = itemsSchema.parse(req.body);
  if (!(await reorderLessonItems(lessonId, items))) {
    res.status(404).json({ error: { message: "Lesson not found." } });
    return;
  }
  res.json({ data: { ok: true } });
}
