// Frontend Course CMS service — the only place axios is called for course data.
// Mirrors backend/server/services/{course,module,lesson,topic,section}.service.ts.
// Hierarchy: Course → {Introduction, Overview, Instructor sections} + Module → Lesson → Topic.

import { api } from "./axios";

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;
export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const CONTENT_TYPES = [
  "video",
  "pdf",
  "presentation",
  "rich_text",
  "infographic",
  "case_study",
  "reflection",
  "activity",
  "discussion",
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export type CourseLevel = (typeof COURSE_LEVELS)[number];
export type ContentType = (typeof CONTENT_TYPES)[number];

/** The institution offering a course ("Offered by"). */
export interface OfferedBy {
  name: string;
  logoUrl: string;
  description: string;
  url: string;
}

/** One assessment category and its share of the course grade (percent). */
export interface GradingWeight {
  category: string;
  weight: number;
}

/** Admin-only fields on imported content (stripped from student/teacher views). */
export interface AdminImportFields {
  importKey?: string | null;
  /** "needs_content": a shell whose source content is missing (admins must add it). */
  contentStatus?: "complete" | "needs_content";
  adminNote?: string;
  gradeCategory?: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  instructor: string;
  /** Credential line for the instructor badge (optional). */
  instructorTitle: string;
  thumbnail: string;
  bannerImage: string;
  status: CourseStatus;
  level: CourseLevel;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  prerequisites: string[];
  tags: string[];
  /** "Skills you'll gain" chips. */
  skills: string[];
  /** "Tools you'll learn" chips. */
  tools: string[];
  offeredBy: OfferedBy;
  /** Downloadable course syllabus (uploaded PDF URL; "" = none). */
  syllabusUrl: string;
  /** Assessment categories and weights (shown on the course page). */
  gradingWeights: GradingWeight[];
  /** Admin only: import notes (source metadata, inconsistencies). */
  adminNote?: string;
  importKey?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Learning-content fields shared by Topics and Course Sections. A piece of content
 *  is multi-part: any of text, audio, a document (PDF/PPT) and video (+ subtitles). */
export interface ContentFields {
  /** Primary-format label. */
  contentType: ContentType;
  /** Text (markdown). */
  content: string;
  /** Narration — uploaded, or generated from the text via text-to-speech. */
  audioUrl: string;
  /** PDF / PowerPoint (or image). */
  documentUrl: string;
  videoUrl: string;
  /** WebVTT captions for `videoUrl` (SRT uploads are converted). */
  subtitleUrl: string;
}

/** Settings of a "discussion" topic; participation happens in its linked forum thread. */
export interface DiscussionConfig {
  prompt: string;
  instructions: string;
  questions: string[];
  relatedTopicId: string | null;
  /** The student must post before the topic can be completed. */
  required: boolean;
}

/** Topic — the actual learning unit: Course → Module → Lesson → **Topic** → content.
 *  In learners' course trees topics carry NO content (text/media are withheld until
 *  the topic is opened — see getPublicTopic). */
export interface Topic extends ContentFields, AdminImportFields {
  id: string;
  lessonId: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationMinutes: number;
  isPreview: boolean;
  /** Students may download this topic's text/media. */
  allowDownload: boolean;
  /** Has a video (true even when media URLs are withheld). */
  hasVideo: boolean;
  discussion: DiscussionConfig;
  /** Visible to students (drafts are admin-only; students never receive drafts). */
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Lesson — a CONTAINER grouping Topics inside a Module (name + optional description). */
export interface Lesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}
/** A lesson assignment as listed in the course tree. */
export interface AssignmentSummary extends AdminImportFields {
  id: string;
  title: string;
  isGraded: boolean;
  isRequired: boolean;
  isPublished: boolean;
  timeLimitMinutes: number;
  estimatedDurationMinutes: number;
  /** Position among the lesson's topics (Topic.order scale; null = after them). */
  order: number | null;
}
/** A lesson with its topics and its assignments (several allowed, positioned by `order`). */
export type LessonWithTopics = Lesson & { topics: Topic[]; assignments: AssignmentSummary[] };

export const SECTION_KINDS = ["introduction", "overview", "instructor"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Course-level content: Course Introduction, Course Overview, Meet the Instructor. */
export interface CourseSection extends ContentFields {
  id: string;
  courseId: string;
  kind: SectionKind;
  title: string;
  description: string;
  order: number;
  estimatedDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  /** What a learner will be able to do after the module. */
  learningObjectives: string[];
  order: number;
  estimatedDurationMinutes: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What a module still needs before it can be published (admin tree only). */
export interface ModuleReadiness {
  hasDescription: boolean;
  hasObjectives: boolean;
  hasAssessment: boolean;
  assessmentPublished: boolean;
  questionCount: number;
  ready: boolean;
  missing: string[];
}

export type ModuleWithLessons = Module & {
  lessons: LessonWithTopics[];
  /** The module's ONE assessment (students: published only; null if none). */
  assessmentId: string | null;
  /** Estimated minutes for that assessment (0 = not estimated). */
  assessmentDurationMinutes: number;
  /** Its timer in minutes (0 = untimed). */
  assessmentTimeLimitMinutes: number;
  readiness?: ModuleReadiness;
  /** Admin tree: items flagged "needs content". */
  needsContent?: number;
  contentStatus?: "complete" | "needs_content";
  adminNote?: string;
  importKey?: string | null;
};
export type CourseTree = Course & { sections: CourseSection[]; modules: ModuleWithLessons[] };

export interface CourseListResult {
  courses: Course[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CourseListParams {
  status?: CourseStatus | "all";
  search?: string;
  page?: number;
  pageSize?: number;
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
  level?: CourseLevel;
  estimatedDurationMinutes?: number;
  learningObjectives?: string[];
  prerequisites?: string[];
  tags?: string[];
  skills?: string[];
  tools?: string[];
  offeredBy?: Partial<OfferedBy>;
  syllabusUrl?: string;
  gradingWeights?: GradingWeight[];
}
export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface CreateModuleInput {
  title: string;
  description?: string;
  learningObjectives?: string[];
  estimatedDurationMinutes?: number;
  isPublished?: boolean;
}
export type UpdateModuleInput = Partial<CreateModuleInput>;

export interface CreateLessonInput {
  title: string;
  description?: string;
}
export type UpdateLessonInput = Partial<CreateLessonInput>;

export interface ContentInput {
  contentType?: ContentType;
  content?: string;
  audioUrl?: string;
  documentUrl?: string;
  videoUrl?: string;
  subtitleUrl?: string;
  estimatedDurationMinutes?: number;
}

export interface CreateTopicInput extends ContentInput {
  title: string;
  contentType: ContentType;
  description?: string;
  isPreview?: boolean;
  allowDownload?: boolean;
  discussion?: Partial<DiscussionConfig>;
  isPublished?: boolean;
  gradeCategory?: string;
  contentStatus?: "complete" | "needs_content";
  adminNote?: string;
}
export type UpdateTopicInput = Partial<CreateTopicInput>;

export interface UpdateSectionInput extends ContentInput {
  title?: string;
  description?: string;
}

const ADMIN = "/admin/courses";

/**
 * Guarantee the tree's arrays exist (sections, modules → lessons → topics), so a
 * backend on an older version — or a partially-built course — can never crash a
 * page that iterates them.
 */
function normalizeTree(tree: CourseTree): CourseTree {
  return {
    ...tree,
    sections: tree.sections ?? [],
    modules: (tree.modules ?? []).map((m) => ({
      ...m,
      learningObjectives: m.learningObjectives ?? [],
      lessons: (m.lessons ?? []).map((l) => ({ ...l, topics: l.topics ?? [], assignments: l.assignments ?? [] })),
    })),
  };
}

// ---- Admin: courses ----
export async function adminListCourses(params: CourseListParams): Promise<CourseListResult> {
  const { data } = await api.get<{ data: CourseListResult }>(ADMIN, { params });
  return data.data;
}
export async function adminGetCourse(courseId: string): Promise<CourseTree> {
  const { data } = await api.get<{ data: CourseTree }>(`${ADMIN}/${courseId}`);
  return normalizeTree(data.data);
}
export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const { data } = await api.post<{ data: Course }>(ADMIN, input);
  return data.data;
}
export async function updateCourse(id: string, patch: UpdateCourseInput): Promise<Course> {
  const { data } = await api.patch<{ data: Course }>(`${ADMIN}/${id}`, patch);
  return data.data;
}
export async function publishCourse(id: string): Promise<Course> {
  const { data } = await api.post<{ data: Course }>(`${ADMIN}/${id}/publish`);
  return data.data;
}
export async function unpublishCourse(id: string): Promise<Course> {
  const { data } = await api.post<{ data: Course }>(`${ADMIN}/${id}/unpublish`);
  return data.data;
}
export async function archiveCourse(id: string): Promise<Course> {
  const { data } = await api.post<{ data: Course }>(`${ADMIN}/${id}/archive`);
  return data.data;
}
export async function deleteCourse(id: string): Promise<void> {
  await api.delete(`${ADMIN}/${id}`);
}

// ---- Admin: modules ----
export async function createModule(courseId: string, input: CreateModuleInput): Promise<Module> {
  const { data } = await api.post<{ data: Module }>(`${ADMIN}/${courseId}/modules`, input);
  return data.data;
}
export async function updateModule(moduleId: string, patch: UpdateModuleInput): Promise<Module> {
  const { data } = await api.patch<{ data: Module }>(`${ADMIN}/modules/${moduleId}`, patch);
  return data.data;
}
export async function deleteModule(moduleId: string): Promise<void> {
  await api.delete(`${ADMIN}/modules/${moduleId}`);
}
export async function reorderModules(courseId: string, orderedIds: string[]): Promise<Module[]> {
  const { data } = await api.post<{ data: Module[] }>(`${ADMIN}/${courseId}/modules/reorder`, {
    orderedIds,
  });
  return data.data;
}

// ---- Admin: lessons (containers within a module) ----
export async function createLesson(moduleId: string, input: CreateLessonInput): Promise<Lesson> {
  const { data } = await api.post<{ data: Lesson }>(`${ADMIN}/modules/${moduleId}/lessons`, input);
  return data.data;
}
export async function updateLesson(lessonId: string, patch: UpdateLessonInput): Promise<Lesson> {
  const { data } = await api.patch<{ data: Lesson }>(`${ADMIN}/lessons/${lessonId}`, patch);
  return data.data;
}
/** Deletes the lesson and all of its topics. */
export async function deleteLesson(lessonId: string): Promise<void> {
  await api.delete(`${ADMIN}/lessons/${lessonId}`);
}
export async function reorderLessons(moduleId: string, orderedIds: string[]): Promise<Lesson[]> {
  const { data } = await api.post<{ data: Lesson[] }>(`${ADMIN}/modules/${moduleId}/lessons/reorder`, { orderedIds });
  return data.data;
}

// ---- Admin: topics (learning units within a lesson) ----
export async function createTopic(lessonId: string, input: CreateTopicInput): Promise<Topic> {
  const { data } = await api.post<{ data: Topic }>(`${ADMIN}/lessons/${lessonId}/topics`, input);
  return data.data;
}
export async function updateTopic(topicId: string, patch: UpdateTopicInput): Promise<Topic> {
  const { data } = await api.patch<{ data: Topic }>(`${ADMIN}/topics/${topicId}`, patch);
  return data.data;
}
export async function deleteTopic(topicId: string): Promise<void> {
  await api.delete(`${ADMIN}/topics/${topicId}`);
}
export async function reorderTopics(lessonId: string, orderedIds: string[]): Promise<Topic[]> {
  const { data } = await api.post<{ data: Topic[] }>(`${ADMIN}/lessons/${lessonId}/topics/reorder`, { orderedIds });
  return data.data;
}

// ---- Admin: course sections (Introduction, Overview, Meet the Instructor) ----
export async function listSections(courseId: string): Promise<CourseSection[]> {
  const { data } = await api.get<{ data: CourseSection[] }>(`${ADMIN}/${courseId}/sections`);
  return data.data;
}
export async function updateSection(courseId: string, kind: SectionKind, patch: UpdateSectionInput): Promise<CourseSection> {
  const { data } = await api.patch<{ data: CourseSection }>(`${ADMIN}/${courseId}/sections/${kind}`, patch);
  return data.data;
}

// ---- Public (role-scoped) ----
export async function listPublicCourses(params: CourseListParams): Promise<CourseListResult> {
  const { data } = await api.get<{ data: CourseListResult }>("/courses", { params });
  return data.data;
}
/**
 * The role-scoped course tree. `view: "outline"` omits topic text bodies (smaller —
 * enough for navigation, landing pages and progress summaries); fetch a topic's
 * body with getPublicTopic.
 */
export async function getPublicCourse(slug: string, view: "full" | "outline" = "full"): Promise<CourseTree> {
  const { data } = await api.get<{ data: CourseTree }>(`/courses/${encodeURIComponent(slug)}`, {
    params: view === "outline" ? { view } : undefined,
  });
  return normalizeTree(data.data);
}

/** One visible topic (full content) + its prev/next ids. */
export interface TopicInCourse {
  courseSlug: string;
  moduleId: string;
  lessonId: string;
  topic: Topic;
  prevTopicId: string | null;
  nextTopicId: string | null;
  /** The forum thread behind a discussion topic. */
  discussionThreadId: string | null;
}
export async function getPublicTopic(slug: string, topicId: string): Promise<TopicInCourse> {
  const { data } = await api.get<{ data: TopicInCourse }>(
    `/courses/${encodeURIComponent(slug)}/topics/${encodeURIComponent(topicId)}`,
  );
  return data.data;
}

export const DOWNLOAD_PARTS = ["text", "video", "audio", "document", "subtitle"] as const;
export type DownloadPart = (typeof DOWNLOAD_PARTS)[number];
/** Same-origin download link for one part of a topic (the backend checks access and
 *  the topic's "Download allowed" switch, then streams/redirects to secure storage). */
export function topicDownloadUrl(slug: string, topicId: string, part: DownloadPart): string {
  return `/api/courses/${encodeURIComponent(slug)}/topics/${encodeURIComponent(topicId)}/download?part=${part}`;
}

/** Persist the combined order of a lesson's topics and assignments. */
export async function reorderLessonItems(lessonId: string, items: { kind: "topic" | "assignment"; id: string }[]): Promise<void> {
  await api.post(`/admin/courses/lessons/${lessonId}/items/reorder`, { items });
}
