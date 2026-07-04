// Frontend Course CMS service — the only place axios is called for course data.
// Mirrors backend/src/services/{course,module,lesson}.service.ts.

import { api } from "./axios";

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;
export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const LESSON_CONTENT_TYPES = [
  "video",
  "pdf",
  "rich_text",
  "infographic",
  "case_study",
  "reflection",
  "activity",
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export type CourseLevel = (typeof COURSE_LEVELS)[number];
export type LessonContentType = (typeof LESSON_CONTENT_TYPES)[number];

/** Content types that use the rich content editor. */
export const RICH_CONTENT_TYPES: LessonContentType[] = ["rich_text", "reflection", "case_study"];

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

export interface Lesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  contentType: LessonContentType;
  videoUrl: string;
  documentUrl: string;
  content: string;
  estimatedDurationMinutes: number;
  isPreview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  estimatedDurationMinutes: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ModuleWithLessons = Module & {
  lessons: Lesson[];
  /** Published assessment id for this module (null if none / unpublished). */
  assessmentId: string | null;
};
export type CourseTree = Course & { modules: ModuleWithLessons[] };

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
  estimatedDurationMinutes?: number;
  isPublished?: boolean;
}
export type UpdateModuleInput = Partial<CreateModuleInput>;

export interface CreateLessonInput {
  title: string;
  contentType: LessonContentType;
  description?: string;
  videoUrl?: string;
  documentUrl?: string;
  content?: string;
  estimatedDurationMinutes?: number;
  isPreview?: boolean;
}
export type UpdateLessonInput = Partial<CreateLessonInput>;

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

// ---- Admin: lessons ----
export async function createLesson(moduleId: string, input: CreateLessonInput): Promise<Lesson> {
  const { data } = await api.post<{ data: Lesson }>(`${ADMIN}/modules/${moduleId}/lessons`, input);
  return data.data;
}
export async function updateLesson(lessonId: string, patch: UpdateLessonInput): Promise<Lesson> {
  const { data } = await api.patch<{ data: Lesson }>(`${ADMIN}/lessons/${lessonId}`, patch);
  return data.data;
}
export async function deleteLesson(lessonId: string): Promise<void> {
  await api.delete(`${ADMIN}/lessons/${lessonId}`);
}
export async function reorderLessons(moduleId: string, orderedIds: string[]): Promise<Lesson[]> {
  const { data } = await api.post<{ data: Lesson[] }>(
    `${ADMIN}/modules/${moduleId}/lessons/reorder`,
    { orderedIds },
  );
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
