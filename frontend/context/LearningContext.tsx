"use client";

// LearningContext — owns the student's *learning* state for the active course:
// completed lessons, current lesson, and course progress. Backed by the Mongo
// progress API (no localStorage, no mock). Auth state stays in AppContext.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  addTime,
  completeLesson as completeLessonReq,
  getCourseProgress,
  markVisited,
  type ProgressDetail,
} from "@/lib/api/progress";

interface LearningContextType {
  courseId: string | null;
  detail: ProgressDetail | null;
  loading: boolean;
  error: boolean;
  /** Load (or reload) progress for a course. */
  load: (courseId: string) => Promise<void>;
  completedLessons: Set<string>;
  /** The lesson the student should resume (last visited or next unlocked). */
  currentLessonId: string | null;
  overallProgress: number;
  certificateEligible: boolean;
  markComplete: (lessonId: string) => Promise<ProgressDetail | null>;
  recordVisit: (lessonId: string) => Promise<void>;
  addMinutes: (minutes: number) => Promise<void>;
  /** Sequential rule: unlocked if first, already done, or predecessor done. */
  isUnlocked: (sequence: string[], lessonId: string) => boolean;
}

const LearningContext = createContext<LearningContextType | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProgressDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (id: string) => {
    setCourseId(id);
    setLoading(true);
    setError(false);
    try {
      setDetail(await getCourseProgress(id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const completedLessons = useMemo(
    () => new Set(detail?.progress.completedLessons ?? []),
    [detail],
  );

  const markComplete = useCallback(
    async (lessonId: string) => {
      if (!courseId) return null;
      const next = await completeLessonReq(courseId, lessonId);
      setDetail(next);
      return next;
    },
    [courseId],
  );

  const recordVisit = useCallback(
    async (lessonId: string) => {
      if (!courseId) return;
      try {
        setDetail(await markVisited(courseId, lessonId));
      } catch {
        /* non-fatal */
      }
    },
    [courseId],
  );

  const addMinutes = useCallback(
    async (minutes: number) => {
      if (!courseId || minutes <= 0) return;
      try {
        setDetail(await addTime(courseId, minutes));
      } catch {
        /* non-fatal */
      }
    },
    [courseId],
  );

  const isUnlocked = useCallback(
    (sequence: string[], lessonId: string) => {
      const idx = sequence.indexOf(lessonId);
      if (idx <= 0) return true;
      return completedLessons.has(lessonId) || completedLessons.has(sequence[idx - 1]);
    },
    [completedLessons],
  );

  const currentLessonId = detail?.progress.lastVisitedLessonId ?? detail?.nextLessonId ?? null;

  return (
    <LearningContext.Provider
      value={{
        courseId,
        detail,
        loading,
        error,
        load,
        completedLessons,
        currentLessonId,
        overallProgress: detail?.progress.overallProgress ?? 0,
        certificateEligible: detail?.progress.certificateEligible ?? false,
        markComplete,
        recordVisit,
        addMinutes,
        isUnlocked,
      }}
    >
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error("useLearning must be used within LearningProvider");
  return ctx;
}
