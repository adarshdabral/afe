// Course section controllers — Course Introduction, Course Overview, Meet the
// Instructor. Admin: list + update content. (Students read them in the course tree.)

import { z } from "zod";
import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { SECTION_KINDS } from "../models/CourseSection";
import { listSections, updateSection } from "../services/section.service";
import { contentFields, idSchema } from "./content.schema";

const kindSchema = z.enum(SECTION_KINDS);
const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    ...contentFields,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

/** GET /api/admin/courses/:courseId/sections */
export async function list(req: Request, res: Response): Promise<void> {
  res.json({ data: await listSections(idSchema.parse(req.params.courseId)) });
}

/** PATCH /api/admin/courses/:courseId/sections/:kind */
export async function update(req: Request, res: Response): Promise<void> {
  const courseId = idSchema.parse(req.params.courseId);
  const kind = kindSchema.parse(req.params.kind);
  const section = await updateSection(courseId, kind, updateSchema.parse(req.body));
  if (!section) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  res.json({ data: section });
}
