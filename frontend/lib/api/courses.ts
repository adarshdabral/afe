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
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export type CourseLevel = (typeof COURSE_LEVELS)[number];
export type ContentType = (typeof CONTENT_TYPES)[number];

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  instructor: string;
  thumbnail: string;
  bannerImage: string;
  status: CourseStatus;
  level: CourseLevel;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  prerequisites: string[];
  tags: string[];
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

/** Topic — the actual learning unit: Course → Module → Lesson → **Topic** → content. */
export interface Topic extends ContentFields {
  id: string;
  lessonId: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationMinutes: number;
  isPreview: boolean;
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
export type LessonWithTopics = Lesson & { topics: Topic[] };

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
  readiness?: ModuleReadiness;
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
  thumbnail?: string;
  bannerImage?: string;
  level?: CourseLevel;
  estimatedDurationMinutes?: number;
  learningObjectives?: string[];
  prerequisites?: string[];
  tags?: string[];
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
}
export type UpdateTopicInput = Partial<CreateTopicInput>;

export interface UpdateSectionInput extends ContentInput {
  title?: string;
  description?: string;
}

const ADMIN = "/admin/courses";

// ---- Admin: courses ----
export async function adminListCourses(params: CourseListParams): Promise<CourseListResult> {
  const { data } = await api.get<{ data: CourseListResult }>(ADMIN, { params });
  return data.data;
}
export async function adminGetCourse(courseId: string): Promise<CourseTree> {
  const { data } = await api.get<{ data: CourseTree }>(`${ADMIN}/${courseId}`);
  return data.data;
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
export async function getPublicCourse(slug: string): Promise<CourseTree> {
  const { data } = await api.get<{ data: CourseTree }>(`/courses/${encodeURIComponent(slug)}`);
  return data.data;
}
