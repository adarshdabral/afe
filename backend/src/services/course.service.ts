// Course service (Course CMS). Owns course CRUD, slug generation/uniqueness,
// status transitions (publish/unpublish/archive), soft delete, role-scoped
// listing, and assembling the ordered course tree (course → modules → lessons).
// No req/res here — pure business logic over the Mongoose models.

import { Course, toCourse, type CourseStatus, type CourseView } from "../models/Course";
import { Module, toModule, type ModuleView } from "../models/Module";
import { Lesson, toLesson, type LessonView } from "../models/Lesson";
import { Assessment } from "../models/Assessment";
import type { Role } from "../shared/access";

export type ModuleNode = ModuleView & {
  lessons: LessonView[];
  /** Published assessment id for this module (admins also see unpublished), else null. */
  assessmentId: string | null;
};

export interface CourseTree extends CourseView {
  modules: ModuleNode[];
}

export interface ListInput {
  status?: CourseStatus | "all";
  search?: string;
  page: number;
  pageSize: number;
}

export interface ListResult {
  courses: CourseView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Turn a title into a url-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** A slug not used by any non-deleted course (appends -2, -3… on collision). */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "course";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await Course.findOne({
      slug: candidate,
      deletedAt: null,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/** True if a slug is already taken by another non-deleted course. */
export async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const doc = await Course.findOne({
    slug: slugify(slug),
    deletedAt: null,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  return !!doc;
}

export interface CreateCourseInput {
  title: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  instructor?: string;
  thumbnail?: string;
  bannerImage?: string;
  level?: "beginner" | "intermediate" | "advanced";
  estimatedDurationMinutes?: number;
  learningObjectives?: string[];
  prerequisites?: string[];
  tags?: string[];
}

export async function createCourse(
  input: CreateCourseInput,
  createdBy: string,
): Promise<CourseView> {
  const slug = input.slug ? slugify(input.slug) : await uniqueSlug(input.title);
  const doc = await Course.create({
    title: input.title.trim(),
    slug,
    description: input.description ?? "",
    shortDescription: input.shortDescription ?? "",
    instructor: input.instructor ?? "",
    thumbnail: input.thumbnail ?? "",
    bannerImage: input.bannerImage ?? "",
    status: "draft",
    level: input.level ?? "beginner",
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
    learningObjectives: input.learningObjectives ?? [],
    prerequisites: input.prerequisites ?? [],
    tags: input.tags ?? [],
    createdBy,
  });
  return toCourse(doc);
}

async function findLive(id: string) {
  return Course.findOne({ _id: id, deletedAt: null }).catch(() => null);
}

export async function getCourse(id: string): Promise<CourseView | null> {
  const doc = await findLive(id);
  return doc ? toCourse(doc) : null;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export async function updateCourse(
  id: string,
  patch: UpdateCourseInput,
): Promise<CourseView | null> {
  const doc = await findLive(id);
  if (!doc) return null;
  if (patch.title !== undefined) doc.title = patch.title.trim();
  // Slug uniqueness on update is enforced by the controller (409); here we just
  // normalize it. (Create derives a guaranteed-unique slug from the title.)
  if (patch.slug !== undefined) doc.slug = slugify(patch.slug);
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.shortDescription !== undefined) doc.shortDescription = patch.shortDescription;
  if (patch.instructor !== undefined) doc.instructor = patch.instructor;
  if (patch.thumbnail !== undefined) doc.thumbnail = patch.thumbnail;
  if (patch.bannerImage !== undefined) doc.bannerImage = patch.bannerImage;
  if (patch.level !== undefined) doc.level = patch.level;
  if (patch.estimatedDurationMinutes !== undefined)
    doc.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  if (patch.learningObjectives !== undefined) doc.learningObjectives = patch.learningObjectives;
  if (patch.prerequisites !== undefined) doc.prerequisites = patch.prerequisites;
  if (patch.tags !== undefined) doc.tags = patch.tags;
  await doc.save();
  return toCourse(doc);
}

/** Transition course status (publish → published, unpublish → draft, archive). */
export async function setCourseStatus(
  id: string,
  status: CourseStatus,
): Promise<CourseView | null> {
  const doc = await findLive(id);
  if (!doc) return null;
  doc.status = status;
  await doc.save();
  return toCourse(doc);
}

/** Soft delete — hides the course from every surface (content is preserved). */
export async function softDeleteCourse(id: string): Promise<boolean> {
  const doc = await findLive(id);
  if (!doc) return false;
  doc.set("deletedAt", new Date());
  await doc.save();
  return true;
}

export async function listCourses(input: ListInput, role: Role | null): Promise<ListResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));

  const filter: Record<string, unknown> = { deletedAt: null };
  // Non-admins only ever see published courses; admins can filter by any status.
  if (role !== "platform_admin") {
    filter.status = "published";
  } else if (input.status && input.status !== "all") {
    filter.status = input.status;
  }

  const search = input.search?.trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: rx }, { shortDescription: rx }, { tags: rx }];
  }

  const total = await Course.countDocuments(filter);
  const docs = await Course.find(filter)
    .sort({ updatedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);

  return {
    courses: docs.map(toCourse),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Assemble the ordered tree for a course doc (modules asc, lessons asc). */
async function buildTree(course: CourseView, includeUnpublished: boolean): Promise<CourseTree> {
  const moduleFilter: Record<string, unknown> = { courseId: course.id };
  if (!includeUnpublished) moduleFilter.isPublished = true;
  const modules = await Module.find(moduleFilter).sort({ order: 1, createdAt: 1 });
  const lessons = await Lesson.find({ courseId: course.id }).sort({ order: 1, createdAt: 1 });

  const byModule = new Map<string, LessonView[]>();
  for (const l of lessons) {
    const v = toLesson(l);
    if (!byModule.has(v.moduleId)) byModule.set(v.moduleId, []);
    byModule.get(v.moduleId)!.push(v);
  }

  // Attach each module's assessment (published only for non-admins).
  const assessmentFilter: Record<string, unknown> = { courseId: course.id };
  if (!includeUnpublished) assessmentFilter.isPublished = true;
  const assessments = await Assessment.find(assessmentFilter).select("_id moduleId");
  const assessmentByModule = new Map<string, string>();
  for (const a of assessments) assessmentByModule.set(a.moduleId, String(a._id));

  return {
    ...course,
    modules: modules.map((m) => {
      const mv = toModule(m);
      return {
        ...mv,
        lessons: byModule.get(mv.id) ?? [],
        assessmentId: assessmentByModule.get(mv.id) ?? null,
      };
    }),
  };
}

/** Admin builder: full tree by id, including unpublished modules. */
export async function getCourseTreeById(id: string): Promise<CourseTree | null> {
  const doc = await findLive(id);
  if (!doc) return null;
  return buildTree(toCourse(doc), true);
}

/**
 * Public/role-scoped fetch by slug.
 *  - platform_admin → any non-deleted course, full tree.
 *  - others         → published courses only, published modules only.
 * Returns null when the caller may not see the course (draft/archived → 404).
 */
export async function getCourseBySlug(slug: string, role: Role | null): Promise<CourseTree | null> {
  const doc = await Course.findOne({ slug: slugify(slug), deletedAt: null }).catch(() => null);
  if (!doc) return null;
  const isAdmin = role === "platform_admin";
  if (!isAdmin && doc.status !== "published") return null;
  return buildTree(toCourse(doc), isAdmin);
}

export interface LessonInCourse {
  courseSlug: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  lesson: LessonView;
  prevLessonId: string | null;
  nextLessonId: string | null;
  /** Flat, ordered lesson-id sequence for the visible tree (learning engine). */
  sequence: string[];
}

/**
 * Fetch a single visible lesson within a course, plus its position in the flat
 * ordered sequence (module order → lesson order) for prev/next navigation and the
 * learning engine's sequential rules. Role-scoped exactly like getCourseBySlug.
 */
export async function getLessonInCourse(
  slug: string,
  lessonId: string,
  role: Role | null,
): Promise<LessonInCourse | null> {
  const tree = await getCourseBySlug(slug, role);
  if (!tree) return null;
  const sequence: string[] = [];
  for (const m of tree.modules) for (const l of m.lessons) sequence.push(l.id);
  const idx = sequence.indexOf(lessonId);
  if (idx === -1) return null; // lesson not visible / not in this course
  const owningModule = tree.modules.find((m) => m.lessons.some((l) => l.id === lessonId))!;
  const lesson = owningModule.lessons.find((l) => l.id === lessonId)!;
  return {
    courseSlug: tree.slug,
    courseTitle: tree.title,
    moduleId: owningModule.id,
    moduleTitle: owningModule.title,
    lesson,
    prevLessonId: idx > 0 ? sequence[idx - 1] : null,
    nextLessonId: idx < sequence.length - 1 ? sequence[idx + 1] : null,
    sequence,
  };
}
