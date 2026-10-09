// Course service (Course CMS). Owns course CRUD, slug generation/uniqueness,
// status transitions (publish/unpublish/archive), soft delete, role-scoped
// listing, and assembling the ordered course tree:
//   course → sections (Introduction, Overview, Instructor) + modules → lessons → topics.
// No req/res here — pure business logic over the Mongoose models.

import { Course, toCourse, type CourseDoc, type CourseStatus, type CourseView, type OfferedBy } from "../models/Course";
import { Module, toModule, type ModuleDoc, type ModuleView } from "../models/Module";
import { Lesson, toLesson, type LessonDoc, type LessonView } from "../models/Lesson";
import { Topic, toTopic, type TopicDoc, type TopicView } from "../models/Topic";
import type { CourseSectionView } from "../models/CourseSection";
import { ensureSections, listSections } from "./section.service";
import { Assessment } from "../models/Assessment";
import { Question } from "../models/Question";
import { readinessFrom, type ModuleReadiness } from "./module.service";
import type { Role } from "../shared/access";
import { withoutAdminFields, type ContentStatus } from "../models/importFields";
import { cachedContent } from "../cache/content-cache";

/** A lesson assignment as it appears in the course tree (students: published only). */
export interface AssignmentSummary {
  id: string;
  title: string;
  isGraded: boolean;
  isRequired: boolean;
  isPublished: boolean;
  timeLimitMinutes: number;
  estimatedDurationMinutes: number;
  /** Position among the lesson's topics (Topic.order scale; null = after them). */
  order: number | null;
  /** Admin tree only. */
  contentStatus?: ContentStatus;
  adminNote?: string;
  importKey?: string | null;
  gradeCategory?: string;
}

/** A lesson (container) with its topics (learning units) and its assignments, in order. */
export type LessonNode = LessonView & { topics: TopicView[]; assignments: AssignmentSummary[] };

export type ModuleNode = ModuleView & {
  lessons: LessonNode[];
  /** Published assessment id for this module (admins also see unpublished), else null. */
  assessmentId: string | null;
  /** Module assessment timer in minutes (0 = untimed). */
  assessmentTimeLimitMinutes: number;
  /** Estimated minutes for that assessment (0 = not estimated / no assessment). */
  assessmentDurationMinutes: number;
  /** Admin tree only: what the module still needs before it can be published. */
  readiness?: ModuleReadiness;
  /** Admin tree only: items in this module flagged "needs content" (imports). */
  needsContent?: number;
};

export interface CourseTree extends CourseView {
  /** Course-level content: Course Introduction, Course Overview, Meet the Instructor. */
  sections: CourseSectionView[];
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
  instructorTitle?: string;
  thumbnail?: string;
  bannerImage?: string;
  level?: "beginner" | "intermediate" | "advanced";
  estimatedDurationMinutes?: number;
  learningObjectives?: string[];
  prerequisites?: string[];
  tags?: string[];
  skills?: string[];
  tools?: string[];
  offeredBy?: Partial<OfferedBy>;
  syllabusUrl?: string;
  gradingWeights?: { category: string; weight: number }[];
}

const EMPTY_OFFERED_BY: OfferedBy = { name: "", logoUrl: "", description: "", url: "" };

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
    instructorTitle: input.instructorTitle ?? "",
    thumbnail: input.thumbnail ?? "",
    bannerImage: input.bannerImage ?? "",
    status: "draft",
    level: input.level ?? "beginner",
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? 0,
    learningObjectives: input.learningObjectives ?? [],
    prerequisites: input.prerequisites ?? [],
    tags: input.tags ?? [],
    skills: input.skills ?? [],
    tools: input.tools ?? [],
    offeredBy: { ...EMPTY_OFFERED_BY, ...input.offeredBy },
    syllabusUrl: input.syllabusUrl ?? "",
    createdBy,
  });
  await ensureSections(String(doc._id)); // every course starts with its 3 sections
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
  if (patch.instructorTitle !== undefined) doc.instructorTitle = patch.instructorTitle;
  if (patch.thumbnail !== undefined) doc.thumbnail = patch.thumbnail;
  if (patch.bannerImage !== undefined) doc.bannerImage = patch.bannerImage;
  if (patch.level !== undefined) doc.level = patch.level;
  if (patch.estimatedDurationMinutes !== undefined)
    doc.estimatedDurationMinutes = patch.estimatedDurationMinutes;
  if (patch.learningObjectives !== undefined) doc.learningObjectives = patch.learningObjectives;
  if (patch.prerequisites !== undefined) doc.prerequisites = patch.prerequisites;
  if (patch.tags !== undefined) doc.tags = patch.tags;
  if (patch.skills !== undefined) doc.set("skills", patch.skills);
  if (patch.gradingWeights !== undefined) doc.set("gradingWeights", patch.gradingWeights);
  if (patch.tools !== undefined) doc.set("tools", patch.tools);
  if (patch.syllabusUrl !== undefined) doc.syllabusUrl = patch.syllabusUrl;
  if (patch.offeredBy !== undefined) {
    // Merge: omitted keys keep their stored value.
    const current = toCourse(doc).offeredBy;
    doc.set("offeredBy", { ...current, ...patch.offeredBy });
  }
  await doc.save();
  await ensureSections(String(doc._id)); // every course starts with its 3 sections
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
  await ensureSections(String(doc._id)); // every course starts with its 3 sections
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
    // Admin-only fields (import key/notes) never leave the admin view.
    courses: docs.map((d) => (role === "platform_admin" ? toCourse(d) : (withoutAdminFields(toCourse(d)) as CourseView))),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Assemble the ordered tree for a course doc (sections; modules → lessons → topics, asc).
 *  Every query runs in ONE parallel round (they only need the course id). */
async function buildTree(course: CourseView, includeUnpublished: boolean): Promise<CourseTree> {
  const moduleFilter: Record<string, unknown> = { courseId: course.id };
  if (!includeUnpublished) moduleFilter.isPublished = true;
  // Published assessments only for non-admins.
  const assessmentFilter: Record<string, unknown> = { courseId: course.id };
  if (!includeUnpublished) assessmentFilter.isPublished = true;
  const topicFilter: Record<string, unknown> = { courseId: course.id };
  if (!includeUnpublished) topicFilter.isPublished = { $ne: false }; // draft topics: admins only
  const [modules, lessons, topics, sections, assessments] = await Promise.all([
    Module.find(moduleFilter).sort({ order: 1, createdAt: 1 }).lean(),
    Lesson.find({ courseId: course.id }).sort({ order: 1, createdAt: 1 }).lean(),
    Topic.find(topicFilter).sort({ order: 1, createdAt: 1 }).lean(),
    listSections(course.id),
    Assessment.find(assessmentFilter)
      .sort({ order: 1, createdAt: 1 })
      .select(
        "_id kind moduleId lessonId title isPublished isGraded isRequired timeLimitMinutes estimatedDurationMinutes order contentStatus adminNote importKey gradeCategory",
      )
      .lean(),
  ]);
  // Lesson assignments (several per lesson, positioned) vs the one module assessment.
  const assignmentsByLesson = new Map<string, AssignmentSummary[]>();
  for (const a of assessments) {
    if (a.kind !== "lesson" || !a.lessonId) continue;
    const summary: AssignmentSummary = {
      id: String(a._id),
      title: a.title,
      isGraded: a.isGraded === true,
      isRequired: a.isRequired !== false,
      isPublished: a.isPublished === true,
      timeLimitMinutes: a.timeLimitMinutes ?? 0,
      estimatedDurationMinutes: a.estimatedDurationMinutes ?? 0,
      order: typeof a.order === "number" ? a.order : null,
      ...(includeUnpublished
        ? {
            contentStatus: a.contentStatus === "needs_content" ? "needs_content" : "complete",
            adminNote: a.adminNote ?? "",
            importKey: a.importKey ?? null,
            gradeCategory: a.gradeCategory ?? "",
          }
        : {}),
    };
    if (!assignmentsByLesson.has(a.lessonId)) assignmentsByLesson.set(a.lessonId, []);
    assignmentsByLesson.get(a.lessonId)!.push(summary);
  }
  const moduleAssessments = assessments.filter((a) => a.kind !== "lesson");

  // Non-admins (students, teachers, visitors) never see admin-only fields.
  const scrub = <T extends object>(v: T) => (includeUnpublished ? v : (withoutAdminFields(v) as T));
  const topicsByLesson = new Map<string, TopicView[]>();
  for (const t of topics) {
    const v = scrub(toTopic(t as unknown as TopicDoc));
    if (!topicsByLesson.has(v.lessonId)) topicsByLesson.set(v.lessonId, []);
    topicsByLesson.get(v.lessonId)!.push(v);
  }
  const byModule = new Map<string, LessonNode[]>();
  for (const l of lessons) {
    const v = scrub(toLesson(l as unknown as LessonDoc));
    if (!byModule.has(v.moduleId)) byModule.set(v.moduleId, []);
    byModule.get(v.moduleId)!.push({ ...v, topics: topicsByLesson.get(v.id) ?? [], assignments: assignmentsByLesson.get(v.id) ?? [] });
  }

  const assessmentByModule = new Map<string, string>();
  for (const a of moduleAssessments) assessmentByModule.set(a.moduleId, String(a._id));

  // Admin builder: per-module readiness (description, objectives, assessment + questions).
  const questionCounts = new Map<string, number>();
  if (includeUnpublished && moduleAssessments.length) {
    const counts = await Question.aggregate<{ _id: string; n: number }>([
      { $match: { assessmentId: { $in: moduleAssessments.map((a) => String(a._id)) } } },
      { $group: { _id: "$assessmentId", n: { $sum: 1 } } },
    ]);
    for (const c of counts) questionCounts.set(c._id, c.n);
  }
  const assessmentDocByModule = new Map(moduleAssessments.map((a) => [a.moduleId, a]));
  const needsContentByModule = new Map<string, number>();
  if (includeUnpublished) {
    for (const x of [...topics, ...assessments]) {
      if (x.contentStatus === "needs_content") needsContentByModule.set(x.moduleId, (needsContentByModule.get(x.moduleId) ?? 0) + 1);
    }
  }

  return {
    ...scrub(course),
    sections,
    modules: modules.map((m) => {
      const mv = scrub(toModule(m as unknown as ModuleDoc));
      return {
        ...mv,
        lessons: byModule.get(mv.id) ?? [],
        assessmentId: assessmentByModule.get(mv.id) ?? null,
        assessmentDurationMinutes: assessmentDocByModule.get(mv.id)?.estimatedDurationMinutes ?? 0,
        assessmentTimeLimitMinutes: assessmentDocByModule.get(mv.id)?.timeLimitMinutes ?? 0,
        ...(includeUnpublished
          ? {
              readiness: readinessFrom(
                mv,
                assessmentDocByModule.has(mv.id)
                  ? {
                      isPublished: assessmentDocByModule.get(mv.id)!.isPublished === true,
                      questionCount: questionCounts.get(String(assessmentDocByModule.get(mv.id)!._id)) ?? 0,
                    }
                  : null,
              ),
              needsContent: needsContentByModule.get(mv.id) ?? 0,
            }
          : {}),
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
  const isAdmin = role === "platform_admin";
  const load = async () => {
    const doc = await Course.findOne({ slug: slugify(slug), deletedAt: null }).lean().catch(() => null);
    if (!doc) return null;
    if (!isAdmin && doc.status !== "published") return null;
    return buildTree(toCourse(doc as unknown as CourseDoc), isAdmin);
  };
  // The published view is identical for every non-admin — serve it from the content
  // cache (invalidated on every CMS write). Admins always read live.
  return isAdmin ? load() : cachedContent(`tree:${slugify(slug)}`, load);
}

/** Staff (teachers, platform admins) see full content; everyone else gets learner views. */
export const isStaffRole = (role: Role | null) => role === "teacher" || role === "platform_admin";

/** A topic without its text body (navigation views). */
const withoutBody = (t: TopicView): TopicView => ({ ...t, content: "" });

/** A topic without ANY content — no text, no media links, no discussion text — for
 *  learners' course trees: locked content must not leak through the outline. Each
 *  topic's content is served on its own, after the student's access check. */
const withoutContent = (t: TopicView): TopicView => ({
  ...t,
  content: "",
  audioUrl: "",
  documentUrl: "",
  videoUrl: "",
  subtitleUrl: "",
  discussion: { ...t.discussion, prompt: "", instructions: "", questions: [] },
});

function mapTopics(tree: CourseTree, f: (t: TopicView) => TopicView): CourseTree {
  return {
    ...tree,
    modules: tree.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l, topics: l.topics.map(f) })),
    })),
  };
}

/**
 * The tree without topic TEXT bodies (`content` → ""), for staff navigation.
 * Returns new objects — the cached tree is never mutated.
 */
export function outlineOf(tree: CourseTree): CourseTree {
  return mapTopics(tree, withoutBody);
}

/** The learner view of a tree: topics carry no content (see withoutContent). */
export function learnerViewOf(tree: CourseTree): CourseTree {
  return mapTopics(tree, withoutContent);
}

export interface TopicInCourse {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  lessonTitle: string;
  topic: TopicView;
  prevTopicId: string | null;
  nextTopicId: string | null;
  /** Flat, ordered topic-id sequence for the visible tree (learning engine). */
  sequence: string[];
}

/**
 * Fetch a single visible topic within a course, plus its position in the flat
 * ordered sequence (module → lesson → topic order) for prev/next navigation and
 * the learning engine's sequential rules. Role-scoped exactly like getCourseBySlug.
 */
export async function getTopicInCourse(
  slug: string,
  topicId: string,
  role: Role | null,
): Promise<TopicInCourse | null> {
  const tree = await getCourseBySlug(slug, role);
  if (!tree) return null;
  const sequence: string[] = [];
  for (const m of tree.modules) for (const l of m.lessons) for (const t of l.topics) sequence.push(t.id);
  const idx = sequence.indexOf(topicId);
  if (idx === -1) return null; // topic not visible / not in this course
  const owningModule = tree.modules.find((m) => m.lessons.some((l) => l.topics.some((t) => t.id === topicId)))!;
  const owningLesson = owningModule.lessons.find((l) => l.topics.some((t) => t.id === topicId))!;
  return {
    courseId: tree.id,
    courseSlug: tree.slug,
    courseTitle: tree.title,
    moduleId: owningModule.id,
    moduleTitle: owningModule.title,
    lessonId: owningLesson.id,
    lessonTitle: owningLesson.title,
    topic: owningLesson.topics.find((t) => t.id === topicId)!,
    prevTopicId: idx > 0 ? sequence[idx - 1] : null,
    nextTopicId: idx < sequence.length - 1 ? sequence[idx + 1] : null,
    sequence,
  };
}
