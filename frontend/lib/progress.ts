// Small progress-related pure helpers (no mock data, no state).

/** Human-readable duration, e.g. "1h 23m", "12m", "45s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** "46 min", "1h 20m", "2h". */
export function formatTimeLeft(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export interface RemainingWork {
  /** Unfinished video topics: count + their estimated minutes. */
  videos: { count: number; minutes: number };
  /** Unfinished reading topics (text, PDF, slides, …): count + estimated minutes. */
  readings: { count: number; minutes: number };
  /** Graded items not yet passed: module assessments + graded lesson assignments. */
  gradedAssessments: number;
}

interface TopicLike {
  id: string;
  contentType: string;
  videoUrl?: string;
  /** Set even when media URLs are withheld (learners' course trees). */
  hasVideo?: boolean;
  estimatedDurationMinutes?: number;
}

interface AssignmentLike {
  id: string;
  isGraded: boolean;
  isPublished?: boolean;
  estimatedDurationMinutes?: number;
}

interface LessonLike {
  topics: (TopicLike & { isPublished?: boolean })[];
  assignments?: AssignmentLike[];
}

/** What a learner can actually do in a lesson: visible topics + published assignments. */
const liveTopics = (l: LessonLike) => l.topics.filter((t) => t.isPublished !== false);
const liveAssignments = (l: LessonLike) => (l.assignments ?? []).filter((a) => a.isPublished !== false);

/**
 * What's left in a course: video vs reading time (from each topic's estimated
 * duration) and graded assessments not yet passed. A topic counts as a video when
 * its primary format is video or it has a video; everything else is reading.
 * Pass an empty `completed` set to get the course totals.
 */
export function remainingWork(
  modules: { assessmentId: string | null; lessons: LessonLike[] }[],
  completed: Set<string>,
  passedAssessmentIds: Set<string>,
): RemainingWork {
  const out: RemainingWork = { videos: { count: 0, minutes: 0 }, readings: { count: 0, minutes: 0 }, gradedAssessments: 0 };
  for (const m of modules) {
    for (const l of m.lessons) {
      for (const t of liveTopics(l)) {
        if (completed.has(t.id)) continue;
        const bucket = t.contentType === "video" || !!t.videoUrl || !!t.hasVideo ? out.videos : out.readings;
        bucket.count += 1;
        bucket.minutes += t.estimatedDurationMinutes || 0;
      }
      for (const a of liveAssignments(l)) if (a.isGraded && !passedAssessmentIds.has(a.id)) out.gradedAssessments += 1;
    }
    if (m.assessmentId && !passedAssessmentIds.has(m.assessmentId)) out.gradedAssessments += 1;
  }
  return out;
}

/** Human line for a bucket, e.g. "46 min of videos left" or "3 videos left" (no estimates). */
export function describeRemaining(
  kind: "video" | "reading",
  b: { count: number; minutes: number },
  suffix = "left",
): string {
  const noun = kind === "video" ? "videos" : "readings";
  const text = b.minutes > 0 ? `${formatTimeLeft(b.minutes)} of ${noun}` : `${b.count} ${b.count === 1 ? kind : noun}`;
  return suffix ? `${text} ${suffix}` : text;
}

export interface ModuleRemaining {
  /** Graded items not yet passed: the module assessment + graded lesson assignments. */
  gradedLeft: number;
  /** Learning units (topics) not yet completed. */
  lessonsLeft: number;
  /** Estimated minutes of unfinished topics, assignments and the assessment. */
  minutesLeft: number;
  /** Totals for the module (what a fresh student, or staff previewing, sees). */
  totalGraded: number;
  totalLessons: number;
  totalMinutes: number;
}

/**
 * What a student still has to do in ONE module, from the module's content and the
 * student's progress record (completed topics + passed assessments). Nothing is
 * stored: it is recomputed whenever progress changes, so it is per-student.
 * Durations come from each topic's estimate and the assessment's estimate; content
 * without an estimate counts toward the item totals but adds no time.
 */
export function moduleRemaining(
  module: { assessmentId: string | null; assessmentDurationMinutes?: number; lessons: LessonLike[] },
  completed: Set<string>,
  passedAssessmentIds: Set<string>,
): ModuleRemaining {
  const out: ModuleRemaining = { gradedLeft: 0, lessonsLeft: 0, minutesLeft: 0, totalGraded: 0, totalLessons: 0, totalMinutes: 0 };
  for (const l of module.lessons) {
    for (const t of liveTopics(l)) {
      const minutes = t.estimatedDurationMinutes || 0;
      out.totalLessons += 1;
      out.totalMinutes += minutes;
      if (completed.has(t.id)) continue;
      out.lessonsLeft += 1;
      out.minutesLeft += minutes;
    }
    for (const a of liveAssignments(l)) {
      const minutes = a.estimatedDurationMinutes || 0;
      out.totalMinutes += minutes;
      if (a.isGraded) out.totalGraded += 1;
      if (!passedAssessmentIds.has(a.id)) {
        out.minutesLeft += minutes;
        if (a.isGraded) out.gradedLeft += 1;
      }
    }
  }
  if (module.assessmentId) {
    const minutes = module.assessmentDurationMinutes || 0;
    out.totalGraded += 1;
    out.totalMinutes += minutes;
    if (!passedAssessmentIds.has(module.assessmentId)) {
      out.gradedLeft += 1;
      out.minutesLeft += minutes;
    }
  }
  return out;
}

/** "1h 25m", "46m" — compact form used in the module summary line. */
export function formatHm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}
