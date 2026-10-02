// Lesson controllers (Course CMS) — lessons are CONTAINERS that group Topics in a
// Module (name + optional description). All mounted behind requireRole("platform_admin").

import { z } from "zod";
import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { createLesson, deleteLesson, reorderLessons, updateLesson } from "../services/lesson.service";
import { idSchema, reorderSchema } from "./content.schema";

const createSchema = z.object({
  title: z.string().trim().min(1, "Lesson name is required.").max(200),
  description: z.string().max(5000).optional(),
});
const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

/** POST /api/admin/courses/modules/:moduleId/lessons */
export async function create(req: Request, res: Response): Promise<void> {
  const moduleId = idSchema.parse(req.params.moduleId);
  const lesson = await createLesson(moduleId, createSchema.parse(req.body));
  if (!lesson) {
    res.status(404).json({ error: { message: "Module not found." } });
    return;
  }
  res.status(201).json({ data: lesson });
}

/** PATCH /api/admin/courses/lessons/:lessonId */
export async function update(req: Request, res: Response): Promise<void> {
  const lessonId = idSchema.parse(req.params.lessonId);
  const lesson = await updateLesson(lessonId, updateSchema.parse(req.body));
  if (!lesson) {
    res.status(404).json({ error: { message: "Lesson not found." } });
    return;
  }
  res.json({ data: lesson });
}

/** DELETE /api/admin/courses/lessons/:lessonId — also deletes its topics. */
export async function remove(req: Request, res: Response): Promise<void> {
  const ok = await deleteLesson(idSchema.parse(req.params.lessonId));
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
