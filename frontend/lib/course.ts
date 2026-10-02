// Single-course product helpers. The platform presents ONE flagship course
// (" Demystifying AI for Everyone"); everything shown publicly is derived from the real course
// tree served by the API — no hard-coded curriculum, outcomes or statistics.

import type { ContentType, CourseLevel, CourseTree, SectionKind } from "@/lib/api/courses";

/** Platform brand vs. course identity. */
export const PLATFORM_NAME = "AI on Wheels";

/** Slug of the flagship course. Mirrors `AI_COURSE_META.slug` in
 *  backend/server/seed/ai-course.data.ts — keep in sync. */
export const FLAGSHIP_SLUG = "ai-for-everyone";

/** Public outline of the course: the tree minus topic bodies/media URLs. */
export interface TopicOutline {
  id: string;
  title: string;
  contentType: ContentType;
  estimatedDurationMinutes: number;
}
export interface LessonOutline {
  id: string;
  title: string;
  description: string;
  topics: TopicOutline[];
}
export interface ModuleOutline {
  id: string;
  title: string;
  description: string;
  learningObjectives: string[];
  estimatedDurationMinutes: number;
  hasAssessment: boolean;
  lessons: LessonOutline[];
}
export interface CourseSectionOutline {
  id: string;
  kind: SectionKind;
  title: string;
  description: string;
  contentType: ContentType;
  content: string;
  audioUrl: string;
  documentUrl: string;
  videoUrl: string;
  subtitleUrl: string;
}
export interface CourseOutline {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  instructor: string;
  level: CourseLevel;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  prerequisites: string[];
  tags: string[];
  sections: CourseSectionOutline[];
  modules: ModuleOutline[];
}

/**
 * Defensive by design: it must never throw on an unexpected payload (e.g. a backend
 * still on an older version without `sections` / `topics`), because a throw here
 * crashes the server-rendered landing pages.
 */
export function toCourseOutline(tree: CourseTree): CourseOutline {
  return {
    id: tree.id,
    slug: tree.slug,
    title: tree.title,
    shortDescription: tree.shortDescription,
    description: tree.description,
    instructor: tree.instructor,
    level: tree.level,
    estimatedDurationMinutes: tree.estimatedDurationMinutes,
    learningObjectives: tree.learningObjectives ?? [],
    prerequisites: tree.prerequisites ?? [],
    tags: tree.tags ?? [],
    sections: (tree.sections ?? []).map((section) => ({
      id: section.id,
      kind: section.kind,
      title: section.title,
      description: section.description,
      contentType: section.contentType,
      content: section.content,
      audioUrl: section.audioUrl,
      documentUrl: section.documentUrl,
      videoUrl: section.videoUrl,
      subtitleUrl: section.subtitleUrl,
    })),
    modules: (tree.modules ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      learningObjectives: m.learningObjectives ?? [],
      estimatedDurationMinutes: m.estimatedDurationMinutes,
      hasAssessment: !!m.assessmentId,
      lessons: (m.lessons ?? []).map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        topics: (l.topics ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          contentType: t.contentType,
          estimatedDurationMinutes: t.estimatedDurationMinutes,
        })),
      })),
    })),
  };
}

export function lessonCount(c: CourseOutline): number {
  return c.modules.reduce((s, m) => s + m.lessons.length, 0);
}

export function topicCount(c: CourseOutline): number {
  return c.modules.reduce((sum, module) => sum + module.lessons.reduce((count, lesson) => count + lesson.topics.length, 0), 0);
}

export function assessmentCount(c: CourseOutline): number {
  return c.modules.filter((m) => m.hasAssessment).length;
}

/** Module duration estimate: the module's own value, else the sum of its lessons. */
export function moduleMinutes(m: ModuleOutline): number {
  return m.estimatedDurationMinutes || m.lessons.reduce((sum, lesson) => sum + lesson.topics.reduce((minutes, topic) => minutes + (topic.estimatedDurationMinutes || 0), 0), 0);
}

/** Course duration estimate: the course's own value, else the sum of its modules. */
export function courseMinutes(c: CourseOutline): number {
  return c.estimatedDurationMinutes || c.modules.reduce((s, m) => s + moduleMinutes(m), 0);
}

/** "45 min", "1 hr 30 min", "9 hrs". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h === 0) return `${m} min`;
  const hrs = `${h} ${h === 1 ? "hr" : "hrs"}`;
  return m ? `${hrs} ${m} min` : hrs;
}

const FORMAT_LABEL: Record<ContentType, string> = {
  video: "Video topics",
  pdf: "PDF readings",
  presentation: "Slide presentations",
  rich_text: "Guided readings",
  infographic: "Infographics",
  case_study: "Case studies",
  reflection: "Reflections",
  activity: "Activities",
};

/** Distinct, human-labelled topic formats actually present in the course. */
export function contentFormats(c: CourseOutline): string[] {
  const seen = new Set<ContentType>();
  for (const module of c.modules) for (const lesson of module.lessons) for (const topic of lesson.topics) seen.add(topic.contentType);
  return [...seen].map((t) => FORMAT_LABEL[t]);
}

export function levelLabel(level: CourseLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/**
 * "What you'll learn" — the course's own learning objectives when an admin has
 * set them; otherwise one per module: its first learning objective (falling back
 * to the module description).
 */
export function learningOutcomes(c: CourseOutline): string[] {
  if (c.learningObjectives.length > 0) return c.learningObjectives;
  return c.modules.map((m) => m.learningObjectives[0] || m.description).filter(Boolean);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function initials(name: string): string {
  const parts = name
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "")
    .trim()
    .split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
