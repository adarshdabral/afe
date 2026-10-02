// Module controllers (Course CMS). All mounted behind requireRole("platform_admin").

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import {
  createModule,
  deleteModule,
  reorderModules,
  updateModule,
} from "../services/module.service";

const objectives = z
  .array(z.string().trim().min(1, "Learning objectives can't be blank.").max(300))
  .max(20);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  learningObjectives: objectives.optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  isPublished: z.boolean().optional(),
});

const updateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    learningObjectives: objectives.optional(),
    estimatedDurationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(1) });
const idSchema = z.string().min(1);

/** POST /api/admin/courses/:courseId/modules */
export async function create(req: Request, res: Response): Promise<void> {
  const courseId = idSchema.parse(req.params.courseId);
  const data = createSchema.parse(req.body);
  const module = await createModule(courseId, data);
  if (!module) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  res.status(201).json({ data: module });
}

/** PATCH /api/admin/courses/modules/:moduleId */
export async function update(req: Request, res: Response): Promise<void> {
  const moduleId = idSchema.parse(req.params.moduleId);
  const patch = updateSchema.parse(req.body);
  const module = await updateModule(moduleId, patch);
  if (!module) {
    res.status(404).json({ error: { message: "Module not found." } });
    return;
  }
  res.json({ data: module });
}

/** DELETE /api/admin/courses/modules/:moduleId — cascades to its lessons and topics. */
export async function remove(req: Request, res: Response): Promise<void> {
  const moduleId = idSchema.parse(req.params.moduleId);
  const ok = await deleteModule(moduleId);
  if (!ok) {
    res.status(404).json({ error: { message: "Module not found." } });
    return;
  }
  res.json({ data: { ok: true } });
}

/** POST /api/admin/courses/:courseId/modules/reorder */
export async function reorder(req: Request, res: Response): Promise<void> {
  const courseId = idSchema.parse(req.params.courseId);
  const { orderedIds } = reorderSchema.parse(req.body);
  const modules = await reorderModules(courseId, orderedIds);
  if (!modules) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  res.json({ data: modules });
}
