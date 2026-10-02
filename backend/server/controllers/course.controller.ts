// Course controllers (Course CMS). Admin handlers are mounted behind
// authenticate + requireRole("platform_admin"); public handlers use
// optionalAuthenticate and scope visibility by role. zod validates all input;
// 404/409 are returned explicitly, everything else flows to the central handler.

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import { COURSE_LEVELS, COURSE_STATUSES } from "../models/Course";
import {
  createCourse,
  getCourse,
  getCourseBySlug,
  getCourseTreeById,
  getTopicInCourse,
  listCourses,
  setCourseStatus,
  slugTaken,
  softDeleteCourse,
  updateCourse,
} from "../services/course.service";

const urlish = z.string().max(1000).optional().or(z.literal(""));
const slugField = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9-]+$/i, "Slug may only contain letters, numbers, and hyphens.");
const stringList = z.array(z.string().max(500)).max(100);

const courseFields = {
  slug: slugField.optional(),
  description: z.string().max(50000).optional(),
  shortDescription: z.string().max(500).optional(),
  instructor: z.string().max(120).optional(),
  thumbnail: urlish,
  bannerImage: urlish,
  level: z.enum(COURSE_LEVELS).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  learningObjectives: stringList.optional(),
  prerequisites: stringList.optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
};

const createSchema = z.object({ title: z.string().min(1).max(200), ...courseFields });

const updateSchema = z
  .object({ title: z.string().min(1).max(200).optional(), ...courseFields })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

const listQuerySchema = z.object({
  status: z.enum(["all", ...COURSE_STATUSES]).default("all"),
  search: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const publicListQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
});

const idSchema = z.string().min(1);

// ---- Admin ------------------------------------------------------------------

/** POST /api/admin/courses */
export async function create(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  if (data.slug && (await slugTaken(data.slug))) {
    res.status(409).json({ error: { message: "A course with this slug already exists." } });
    return;
  }
  const course = await createCourse(data, req.user!.id);
  res.status(201).json({ data: course });
}

/** GET /api/admin/courses — list all (any status), searchable + paginated. */
export async function list(req: Request, res: Response): Promise<void> {
  const q = listQuerySchema.parse(req.query);
  const result = await listCourses(q, "platform_admin");
  res.json({ data: result });
}

/** GET /api/admin/courses/:courseId — full ordered tree for the builder. */
export async function getTree(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.courseId);
  const tree = await getCourseTreeById(id);
  if (!tree) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  res.json({ data: tree });
}

/** PATCH /api/admin/courses/:courseId */
export async function update(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.courseId);
  const patch = updateSchema.parse(req.body);
  if (patch.slug && (await slugTaken(patch.slug, id))) {
    res.status(409).json({ error: { message: "A course with this slug already exists." } });
    return;
  }
  const course = await updateCourse(id, patch);
  if (!course) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  res.json({ data: course });
}

function statusHandler(status: "published" | "draft" | "archived") {
  return async (req: Request, res: Response): Promise<void> => {
    const id = idSchema.parse(req.params.courseId);
    const course = await setCourseStatus(id, status);
    if (!course) {
      res.status(404).json({ error: { message: "Course not found." } });
      return;
    }
    res.json({ data: course });
  };
}

/** POST /api/admin/courses/:courseId/publish */
export const publish = statusHandler("published");
/** POST /api/admin/courses/:courseId/unpublish → back to draft */
export const unpublish = statusHandler("draft");
/** POST /api/admin/courses/:courseId/archive */
export const archive = statusHandler("archived");

/** DELETE /api/admin/courses/:courseId — soft delete. */
export async function remove(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.courseId);
  const ok = await softDeleteCourse(id);
  if (!ok) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  res.json({ data: { ok: true } });
}

// ---- Public (role-scoped) ---------------------------------------------------

/** GET /api/courses — students/teachers see published only; admins see all. */
export async function publicList(req: Request, res: Response): Promise<void> {
  const q = publicListQuerySchema.parse(req.query);
  const result = await listCourses({ ...q, status: "all" }, req.user?.role ?? null);
  res.json({ data: result });
}

/** GET /api/courses/:slug — ordered tree; 404 for non-admins on draft/archived. */
export async function publicGetBySlug(req: Request, res: Response): Promise<void> {
  const slug = z.string().min(1).parse(req.params.slug);
  const tree = await getCourseBySlug(slug, req.user?.role ?? null);
  if (!tree) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  res.json({ data: tree });
}

/** GET /api/courses/:slug/topics/:topicId — a visible topic + prev/next. */
export async function publicGetTopic(req: Request, res: Response): Promise<void> {
  const slug = z.string().min(1).parse(req.params.slug);
  const topicId = z.string().min(1).parse(req.params.topicId);
  const result = await getTopicInCourse(slug, topicId, req.user?.role ?? null);
  if (!result) {
    res.status(404).json({ error: { message: "Topic not found." } });
    return;
  }
  res.json({ data: result });
}
