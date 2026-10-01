// Teacher-management controllers. Every handler here is mounted behind
// `authenticate` + `requireRole("platform_admin")` (see teacher.routes.ts), so
// these bodies assume an authenticated platform admin. Validation is zod;
// conflicts (409) and not-found (404) are returned explicitly, everything else
// flows through the central error handler.

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import {
  createTeacher,
  emailTaken,
  getTeacher,
  listTeachers,
  resetTeacherPassword,
  setTeacherActive,
  updateTeacher,
} from "../services/teacher.service";

const emailField = z.string().email();
const mobileField = z.string().min(7).max(20).optional().or(z.literal(""));
const shortText = (max: number) => z.string().max(max).optional().or(z.literal(""));

// Optional teacher profile fields, shared by create + update.
const profileFields = {
  mobile: mobileField,
  designation: shortText(120),
  organization: shortText(160),
  specialization: shortText(160),
  bio: shortText(1000),
  profilePhoto: z.string().url().max(500).optional().or(z.literal("")),
};

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: emailField,
  ...profileFields,
});

// Partial edit — every field optional, but at least one must be present.
const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: emailField.optional(),
    ...profileFields,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

const idSchema = z.string().min(1);

/** POST /api/admin/teachers — create a teacher + return generated credentials. */
export async function create(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  if (await emailTaken(data.email)) {
    res.status(409).json({ error: { message: "A teacher with this email already exists." } });
    return;
  }
  const result = await createTeacher({
    name: data.name,
    email: data.email,
    mobile: data.mobile || undefined,
    designation: data.designation || undefined,
    organization: data.organization || undefined,
    specialization: data.specialization || undefined,
    bio: data.bio || undefined,
    profilePhoto: data.profilePhoto || undefined,
  });
  res.status(201).json({ data: result });
}

/** GET /api/admin/teachers — paginated / searchable / filtered listing. */
export async function list(req: Request, res: Response): Promise<void> {
  const q = listQuerySchema.parse(req.query);
  const result = await listTeachers(q);
  res.json({ data: result });
}

/** GET /api/admin/teachers/:id */
export async function get(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.id);
  const teacher = await getTeacher(id);
  if (!teacher) {
    res.status(404).json({ error: { message: "Teacher not found." } });
    return;
  }
  res.json({ data: teacher });
}

/** PATCH /api/admin/teachers/:id — edit name / email / mobile / profile fields. */
export async function update(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.id);
  const patch = updateSchema.parse(req.body);
  if (patch.email && (await emailTaken(patch.email, id))) {
    res.status(409).json({ error: { message: "A teacher with this email already exists." } });
    return;
  }
  const teacher = await updateTeacher(id, patch);
  if (!teacher) {
    res.status(404).json({ error: { message: "Teacher not found." } });
    return;
  }
  res.json({ data: teacher });
}

/** POST /api/admin/teachers/:id/activate */
export async function activate(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.id);
  const teacher = await setTeacherActive(id, true);
  if (!teacher) {
    res.status(404).json({ error: { message: "Teacher not found." } });
    return;
  }
  res.json({ data: teacher });
}

/** POST /api/admin/teachers/:id/deactivate */
export async function deactivate(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.id);
  const teacher = await setTeacherActive(id, false);
  if (!teacher) {
    res.status(404).json({ error: { message: "Teacher not found." } });
    return;
  }
  res.json({ data: teacher });
}

/** POST /api/admin/teachers/:id/reset-password — issue a fresh temp password. */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const id = idSchema.parse(req.params.id);
  const result = await resetTeacherPassword(id);
  if (!result) {
    res.status(404).json({ error: { message: "Teacher not found." } });
    return;
  }
  res.json({ data: result });
}
