// Lesson controllers (Course CMS). All mounted behind requireRole("platform_admin").

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import { LESSON_CONTENT_TYPES } from "../models/Lesson";
import {
  createLesson,
  deleteLesson,
  reorderLessons,
  updateLesson,
} from "../services/lesson.service";

const urlish = z.string().max(2000).optional().or(z.literal(""));

const baseFields = {
  description: z.string().max(5000).optional(),
  videoUrl: urlish,
  documentUrl: urlish,
  content: z.string().max(200000).optional(), // serialized markdown / rich content
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  isPreview: z.boolean().optional(),
};

const createSchema = z.object({
  title: z.string().min(1).max(200),
  contentType: z.enum(LESSON_CONTENT_TYPES),
  ...baseFields,
});

const updateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    contentType: z.enum(LESSON_CONTENT_TYPES).optional(),
    ...baseFields,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });
const idSchema = z.string().min(1);

/** POST /api/admin/courses/modules/:moduleId/lessons */
export async function create(req: Request, res: Response): Promise<void> {
  const moduleId = idSchema.parse(req.params.moduleId);
  const data = createSchema.parse(req.body);
  const lesson = await createLesson(moduleId, data);
  if (!lesson) {
    res.status(404).json({ error: { message: "Module not found." } });
    return;
  }
  res.status(201).json({ data: lesson });
}

/** PATCH /api/admin/courses/lessons/:lessonId */
export async function update(req: Request, res: Response): Promise<void> {
  const lessonId = idSchema.parse(req.params.lessonId);
  const patch = updateSchema.parse(req.body);
  const lesson = await updateLesson(lessonId, patch);
  if (!lesson) {
    res.status(404).json({ error: { message: "Lesson not found." } });
    return;
  }
  res.json({ data: lesson });
}

/** DELETE /api/admin/courses/lessons/:lessonId */
export async function remove(req: Request, res: Response): Promise<void> {
  const lessonId = idSchema.parse(req.params.lessonId);
  const ok = await deleteLesson(lessonId);
  if (!ok) {
    res.status(404).json({ error: { message: "Lesson not found." } });
    return;
  }
  res.json({ data: { ok: true } });
}

/** POST /api/admin/courses/modules/:moduleId/lessons/reorder */
export async function reorder(req: Request, res: Response): Promise<void> {
  const moduleId = idSchema.parse(req.params.moduleId);
  const { orderedIds } = reorderSchema.parse(req.body);
  const lessons = await reorderLessons(moduleId, orderedIds);
  if (!lessons) {
    res.status(404).json({ error: { message: "Module not found." } });
    return;
  }
  res.json({ data: lessons });
}
