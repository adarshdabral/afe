// Course controllers (Course CMS). Admin handlers are mounted behind
// authenticate + requireRole("platform_admin"); public handlers use
// optionalAuthenticate and scope visibility by role. zod validates all input;
// 404/409 are returned explicitly, everything else flows to the central handler.

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import { COURSE_LEVELS, COURSE_STATUSES } from "../models/Course";
import { checkItemAccess } from "../services/progress.service";
import { discussionThreadId } from "../services/forum.service";
import { HttpError } from "../http/errors";
import { keyForPublicUrl, presignDownload } from "../utils/r2";
import { slugify as slugifyName } from "../services/course.service";
import {
  createCourse,
  getCourse,
  getCourseBySlug,
  getCourseTreeById,
  getTopicInCourse,
  isStaffRole,
  learnerViewOf,
  outlineOf,
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
/** Chip lists (skills, tools): trimmed, non-empty, de-duplicated. */
const chipList = z
  .array(z.string().trim().min(1).max(80))
  .max(30)
  .transform((xs) => [...new Set(xs)]);

const courseFields = {
  slug: slugField.optional(),
  description: z.string().max(50000).optional(),
  shortDescription: z.string().max(500).optional(),
  instructor: z.string().max(120).optional(),
  instructorTitle: z.string().max(200).optional(),
  thumbnail: urlish,
  bannerImage: urlish,
  syllabusUrl: urlish,
  level: z.enum(COURSE_LEVELS).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  learningObjectives: stringList.optional(),
  prerequisites: stringList.optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  skills: chipList.optional(),
  gradingWeights: z
    .array(z.object({ category: z.string().trim().min(1).max(120), weight: z.coerce.number().min(0).max(100) }))
    .max(20)
    .optional(),
  tools: chipList.optional(),
  offeredBy: z
    .object({
      name: z.string().trim().max(200).optional(),
      logoUrl: urlish,
      description: z.string().max(2000).optional(),
      url: urlish,
    })
    .optional(),
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

/** GET /api/courses/:slug — ordered tree; 404 for non-admins on draft/archived.
 *  Staff get full content (`?view=outline` omits topic text bodies). Students and
 *  anonymous visitors always get the learner view: no topic content at all — each
 *  topic's content comes from the topic endpoint, after the sequence check. */
export async function publicGetBySlug(req: Request, res: Response): Promise<void> {
  const slug = z.string().min(1).parse(req.params.slug);
  const { view } = z.object({ view: z.enum(["full", "outline"]).default("full") }).parse(req.query);
  const role = req.user?.role ?? null;
  const tree = await getCourseBySlug(slug, role);
  if (!tree) {
    res.status(404).json({ error: { message: "Course not found." } });
    return;
  }
  if (!isStaffRole(role)) res.json({ data: learnerViewOf(tree) });
  else res.json({ data: view === "outline" ? outlineOf(tree) : tree });
}

/**
 * A visible topic the caller may open: staff — any; students — only when it is
 * unlocked in their learning sequence (403 otherwise, even by direct URL/API);
 * anonymous visitors — free-preview topics only.
 */
async function accessibleTopic(req: Request) {
  const slug = z.string().min(1).parse(req.params.slug);
  const topicId = z.string().min(1).parse(req.params.topicId);
  const role = req.user?.role ?? null;
  const result = await getTopicInCourse(slug, topicId, role);
  if (!result) throw new HttpError(404, "Topic not found.");
  if (role === "student") {
    const access = await checkItemAccess(req.user!.id, result.courseId, topicId);
    if (!access.ok) throw new HttpError(access.reason === "locked" ? 403 : 404, access.message);
  } else if (!role && !result.topic.isPreview) {
    throw new HttpError(401, "Sign in to open this topic.");
  }
  return result;
}

/** GET /api/courses/:slug/topics/:topicId — a topic the caller may open + prev/next
 *  (+ the forum thread behind a discussion topic). */
export async function publicGetTopic(req: Request, res: Response): Promise<void> {
  const result = await accessibleTopic(req);
  const threadId = result.topic.contentType === "discussion" ? await discussionThreadId(result.topic.id) : null;
  res.json({ data: { ...result, discussionThreadId: threadId } });
}

const DOWNLOAD_PARTS = ["text", "video", "audio", "document", "subtitle"] as const;
const PART_FIELD = { video: "videoUrl", audio: "audioUrl", document: "documentUrl", subtitle: "subtitleUrl" } as const;

/**
 * GET /api/courses/:slug/topics/:topicId/download?part=text|video|audio|document|subtitle
 * Downloads one part of a topic the caller may open. Students need the topic's
 * "Download allowed" switch on. Files are served through the existing storage —
 * a short-lived presigned R2 link, or the local uploads route — never by exposing
 * storage credentials. External links (e.g. YouTube) can't be downloaded.
 */
export async function downloadTopic(req: Request, res: Response): Promise<void> {
  const { part } = z.object({ part: z.enum(DOWNLOAD_PARTS) }).parse(req.query);
  const { topic } = await accessibleTopic(req);
  if (!isStaffRole(req.user?.role ?? null) && !topic.allowDownload) {
    throw new HttpError(403, "Downloads are not enabled for this topic.");
  }
  res.setHeader("Cache-Control", "no-store"); // presigned links are per-request
  const base = slugifyName(topic.title) || "topic";
  if (part === "text") {
    if (!topic.content.trim()) throw new HttpError(404, "This topic has no text to download.");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${base}.md"`);
    res.send(`# ${topic.title}\n\n${topic.content}\n`);
    return;
  }
  const url = topic[PART_FIELD[part]];
  if (!url) throw new HttpError(404, `This topic has no ${part} to download.`);
  const ext = (/\.([a-z0-9]{1,5})(?:[?#]|$)/i.exec(url)?.[1] ?? "").toLowerCase();
  const filename = ext ? `${base}.${ext}` : base;
  const key = keyForPublicUrl(url);
  let location: string | null = null;
  if (key) location = await presignDownload(key, filename); // R2: short-lived signed link
  else if (url.startsWith("/api/uploads/")) location = `${url.split("?")[0]}?download=${encodeURIComponent(filename)}`;
  if (!location) throw new HttpError(409, "This file is hosted elsewhere and can't be downloaded here.");
  res.status(302);
  res.setHeader("Location", location);
  res.send("");
}
