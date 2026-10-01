// Single-course product helpers. The platform presents ONE flagship course
// ("AI for Everyone"); everything shown publicly is derived from the real course
// tree served by the API — no hard-coded curriculum, outcomes or statistics.

import type { CourseLevel, CourseTree, LessonContentType } from "@/lib/api/courses";

/** Platform brand vs. course identity. */
export const PLATFORM_NAME = "AI Spark";

/** Slug of the flagship course. Mirrors `AI_COURSE_META.slug` in
 *  backend/server/seed/ai-course.data.ts — keep in sync. */
export const FLAGSHIP_SLUG = "ai-for-everyone";

/** Public outline of the course: the tree minus lesson bodies/media URLs, so
 *  landing pages never ship protected lesson content to the browser. */
export interface LessonOutline {
  id: string;
  title: string;
  contentType: LessonContentType;
  estimatedDurationMinutes: number;
}
export interface ModuleOutline {
  id: string;
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  hasAssessment: boolean;
  lessons: LessonOutline[];
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
  modules: ModuleOutline[];
}

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
    modules: tree.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      estimatedDurationMinutes: m.estimatedDurationMinutes,
      hasAssessment: !!m.assessmentId,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        contentType: l.contentType,
        estimatedDurationMinutes: l.estimatedDurationMinutes,
      })),
    })),
  };
}

export function lessonCount(c: CourseOutline): number {
  return c.modules.reduce((s, m) => s + m.lessons.length, 0);
}

export function assessmentCount(c: CourseOutline): number {
  return c.modules.filter((m) => m.hasAssessment).length;
}

/** Module duration estimate: the module's own value, else the sum of its lessons. */
export function moduleMinutes(m: ModuleOutline): number {
  return m.estimatedDurationMinutes || m.lessons.reduce((s, l) => s + (l.estimatedDurationMinutes || 0), 0);
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

const FORMAT_LABEL: Record<LessonContentType, string> = {
  video: "Video lessons",
  pdf: "PDF readings",
  presentation: "Slide presentations",
  rich_text: "Guided readings",
  infographic: "Infographics",
  case_study: "Case studies",
  reflection: "Reflections",
  activity: "Activities",
};

/** Distinct, human-labelled lesson formats actually present in the course. */
export function contentFormats(c: CourseOutline): string[] {
  const seen = new Set<LessonContentType>();
  for (const m of c.modules) for (const l of m.lessons) seen.add(l.contentType);
  return [...seen].map((t) => FORMAT_LABEL[t]);
}

export function levelLabel(level: CourseLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/**
 * "What you'll learn" — the course's own learning objectives when an admin has
 * set them; otherwise each module's description from the real curriculum.
 */
export function learningOutcomes(c: CourseOutline): string[] {
  if (c.learningObjectives.length > 0) return c.learningObjectives;
  return c.modules.map((m) => m.description).filter(Boolean);
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
