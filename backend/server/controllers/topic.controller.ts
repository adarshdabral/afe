// Topic controllers (Course CMS) — the learning units inside a Lesson. All mounted
// behind requireRole("platform_admin").

import { z } from "zod";
import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { TOPIC_CONTENT_TYPES } from "../models/Topic";
import { createTopic, deleteTopic, reorderTopics, updateTopic } from "../services/topic.service";
import { contentFields, idSchema, reorderSchema } from "./content.schema";

const base = {
  description: z.string().max(5000).optional(),
  ...contentFields,
  isPreview: z.boolean().optional(),
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
  res.json({ data: topic });
}

/** DELETE /api/admin/courses/topics/:topicId */
export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await deleteTopic(idSchema.parse(req.params.topicId));
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
