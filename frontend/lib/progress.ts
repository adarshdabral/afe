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
  /** Published module assessments not yet passed. */
  gradedAssessments: number;
}

interface TopicLike {
  id: string;
  contentType: string;
  videoUrl?: string;
  estimatedDurationMinutes?: number;
}

/**
 * What's left in a course: video vs reading time (from each topic's estimated
 * duration) and graded assessments not yet passed. A topic counts as a video when
 * its primary format is video or it has a video; everything else is reading.
 * Pass an empty `completed` set to get the course totals.
 */
export function remainingWork(
  modules: { assessmentId: string | null; lessons: { topics: TopicLike[] }[] }[],
  completed: Set<string>,
  passedAssessmentIds: Set<string>,
): RemainingWork {
  const out: RemainingWork = { videos: { count: 0, minutes: 0 }, readings: { count: 0, minutes: 0 }, gradedAssessments: 0 };
  for (const m of modules) {
    for (const l of m.lessons) {
      for (const t of l.topics) {
        if (completed.has(t.id)) continue;
        const bucket = t.contentType === "video" || !!t.videoUrl ? out.videos : out.readings;
        bucket.count += 1;
        bucket.minutes += t.estimatedDurationMinutes || 0;
      }
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
