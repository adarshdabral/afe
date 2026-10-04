"use client";

// LearningContext — owns the student's *learning* state for the active course:
// completed topics, current topic, and course progress (progress is per TOPIC). Backed by the Mongo
// progress API (no localStorage, no mock). Auth state stays in AppContext.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addTime,
  completeTopic as completeTopicReq,
  getCourseProgress,
  markVisited,
  type ProgressDetail,
} from "@/lib/api/progress";

interface LearningContextType {
  courseId: string | null;
  detail: ProgressDetail | null;
  loading: boolean;
  error: boolean;
  /** Load (or reload) progress for a course. Reloading the course already loaded
   *  keeps the current state on screen and refreshes it in the background. */
  load: (courseId: string, opts?: { force?: boolean }) => Promise<void>;
  /** The course whose progress has been fetched at least once (even if that failed,
   *  e.g. staff get 403) — pages need not wait for `load` again for it. */
  loadedCourseId: string | null;
  completedTopics: Set<string>;
  /** The topic the student should resume (last visited or next unlocked). */
  currentTopicId: string | null;
  overallProgress: number;
  certificateEligible: boolean;
  markComplete: (topicId: string) => Promise<ProgressDetail | null>;
  recordVisit: (topicId: string) => Promise<void>;
  addMinutes: (minutes: number) => Promise<void>;
  /** Sequential rule: unlocked if first, already done, or predecessor done. */
  isUnlocked: (sequence: string[], topicId: string) => boolean;
}

const LearningContext = createContext<LearningContextType | null>(null);
const PROGRESS_FRESH_MS = 30_000;

export function LearningProvider({ children }: { children: ReactNode }) {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProgressDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loadedCourseId, setLoadedCourseId] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const fetchedAt = useRef(0);

  // Progress changes only through this context (complete/visit/time all return the
  // fresh record), so a same-course reload within PROGRESS_FRESH_MS is skipped
  // unless forced (e.g. after an assessment attempt, which updates it server-side).
  const load = useCallback(async (id: string, opts?: { force?: boolean }) => {
    const switching = current.current !== id;
    if (!switching && !opts?.force && Date.now() - fetchedAt.current < PROGRESS_FRESH_MS) return;
    current.current = id;
    fetchedAt.current = Date.now();
    setCourseId(id);
    if (switching) {
      setDetail(null); // never show another course's progress
      setLoading(true);
    }
    setError(false);
    try {
      const next = await getCourseProgress(id);
      if (current.current === id) setDetail(next);
    } catch {
      if (current.current === id) {
        setError(true);
        fetchedAt.current = 0; // retry on the next load
      }
    } finally {
      if (current.current === id) {
        setLoading(false);
        setLoadedCourseId(id);
      }
    }
  }, []);

  const completedTopics = useMemo(
    () => new Set(detail?.progress.completedTopics ?? []),
    [detail],
  );

  const markComplete = useCallback(
    async (topicId: string) => {
      if (!courseId) return null;
      const next = await completeTopicReq(courseId, topicId);
      setDetail(next);
      return next;
    },
    [courseId],
  );

  const recordVisit = useCallback(
    async (topicId: string) => {
      if (!courseId) return;
      try {
        setDetail(await markVisited(courseId, topicId));
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
    (sequence: string[], topicId: string) => {
      const idx = sequence.indexOf(topicId);
      if (idx <= 0) return true;
      return completedTopics.has(topicId) || completedTopics.has(sequence[idx - 1]);
    },
    [completedTopics],
  );

  const currentTopicId = detail?.progress.lastVisitedTopicId ?? detail?.nextTopicId ?? null;

  return (
    <LearningContext.Provider
      value={{
        courseId,
        detail,
        loading,
        error,
        load,
        loadedCourseId,
        completedTopics,
        currentTopicId,
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
