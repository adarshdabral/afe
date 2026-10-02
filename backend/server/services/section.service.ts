// Course sections service: the three course-level content pages (Course
// Introduction, Course Overview, Meet the Instructor). Every course has exactly
// one of each — created with the course and back-filled for older courses.

import { Course } from "../models/Course";
import {
  CourseSection,
  SECTION_KINDS,
  SECTION_TITLES,
  toCourseSection,
  type CourseSectionView,
  type SectionKind,
} from "../models/CourseSection";
import type { ContentType } from "../models/content";

/** Create any missing sections for a course (idempotent). */
export async function ensureSections(courseId: string): Promise<void> {
  const have = new Set((await CourseSection.find({ courseId }).select("kind")).map((s) => s.kind));
  for (const kind of SECTION_KINDS) {
    if (have.has(kind)) continue;
    await CourseSection.create({ courseId, kind, title: SECTION_TITLES[kind] }).catch((err: { code?: number }) => {
      if (err?.code !== 11000) throw err; // created concurrently — fine
    });
  }
}

/** The course's sections in display order (introduction, overview, instructor). */
export async function listSections(courseId: string): Promise<CourseSectionView[]> {
  await ensureSections(courseId);
  const docs = await CourseSection.find({ courseId });
  return docs.map(toCourseSection).sort((a, b) => a.order - b.order);
}

export interface UpdateSectionInput {
  title?: string;
  description?: string;
  contentType?: ContentType;
  content?: string;
  audioUrl?: string;
  documentUrl?: string;
  videoUrl?: string;
  subtitleUrl?: string;
  estimatedDurationMinutes?: number;
}

/** Update one section's content. Null if the course doesn't exist. */
export async function updateSection(
  courseId: string,
  kind: SectionKind,
  patch: UpdateSectionInput,
): Promise<CourseSectionView | null> {
  const course = await Course.findOne({ _id: courseId, deletedAt: null }).catch(() => null);
  if (!course) return null;
  await ensureSections(courseId);
  const doc = await CourseSection.findOne({ courseId, kind });
  if (!doc) return null;
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) doc.set(k, k === "title" ? String(v).trim() : v);
  await doc.save();
  return toCourseSection(doc);
}
