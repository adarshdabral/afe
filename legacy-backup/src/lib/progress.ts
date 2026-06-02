// Progress-tracking aggregation (SRS FR-08). Pure derivation over the three
// stored maps — module completion (completedLessons), time spent, and
// assessment results — so the same numbers can later be computed server-side
// for class/school analytics (FR-12). No state here.

import {
  AI_COURSE,
  flattenLessons,
  moduleProgress,
  type Course,
  type Module,
} from "@/data/curriculum";
import type { AssessmentResult } from "@/data/assessments";

export interface ProgressInputs {
  completedLessons: Record<string, boolean>;
  timeSpent: Record<string, number>; // seconds, keyed by lessonId
  assessmentScores: Record<string, AssessmentResult>;
}

/** Human-readable duration, e.g. "1h 23m", "12m", "45s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function moduleTimeSpent(module: Module, timeSpent: Record<string, number>): number {
  return module.lessons.reduce((sum, l) => sum + (timeSpent[l.id] ?? 0), 0);
}

export interface ModuleSummary {
  module: Module;
  lessonsDone: number;
  lessonsTotal: number;
  lessonPct: number;
  timeSpentSec: number;
  assessment: AssessmentResult | null;
  /** Fully complete = all lessons done AND module assessment passed (FR-06/07). */
  complete: boolean;
}

export function moduleSummary(module: Module, inputs: ProgressInputs): ModuleSummary {
  const mp = moduleProgress(module, inputs.completedLessons);
  const assessment = inputs.assessmentScores[module.id] ?? null;
  return {
    module,
    lessonsDone: mp.done,
    lessonsTotal: mp.total,
    lessonPct: mp.pct,
    timeSpentSec: moduleTimeSpent(module, inputs.timeSpent),
    assessment,
    complete: mp.pct === 100 && !!assessment?.passed,
  };
}

export interface CourseProgress {
  modules: ModuleSummary[];
  lessonsCompleted: number;
  lessonsTotal: number;
  /** Modules fully complete (lessons + assessment passed). */
  modulesCompleted: number;
  modulesTotal: number;
  assessmentsPassed: number;
  assessmentsAttempted: number;
  totalTimeSec: number;
  /** Average score across attempted assessments, or null if none yet. */
  avgScorePct: number | null;
  /** Lessons-based overall percentage. */
  overallPct: number;
}

export function buildCourseProgress(
  inputs: ProgressInputs,
  course: Course = AI_COURSE,
): CourseProgress {
  const modules = course.modules.map((m) => moduleSummary(m, inputs));
  const lessonsTotal = flattenLessons(course).length;
  const lessonsCompleted = modules.reduce((s, m) => s + m.lessonsDone, 0);
  const attempted = modules.map((m) => m.assessment).filter((a): a is AssessmentResult => !!a);
  const totalTimeSec = Object.values(inputs.timeSpent).reduce((s, v) => s + v, 0);

  return {
    modules,
    lessonsCompleted,
    lessonsTotal,
    modulesCompleted: modules.filter((m) => m.complete).length,
    modulesTotal: course.modules.length,
    assessmentsPassed: attempted.filter((a) => a.passed).length,
    assessmentsAttempted: attempted.length,
    totalTimeSec,
    avgScorePct: attempted.length
      ? Math.round(attempted.reduce((s, a) => s + a.scorePct, 0) / attempted.length)
      : null,
    overallPct: lessonsTotal ? Math.round((lessonsCompleted / lessonsTotal) * 100) : 0,
  };
}
