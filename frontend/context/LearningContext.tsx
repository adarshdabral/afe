"use client";

// LearningContext — owns the student's *learning* state for the active course:
// completed topics, current topic, and course progress (progress is per TOPIC). Backed by the Mongo
// progress API (no localStorage, no mock). Auth state stays in AppContext.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
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
  /** Load (or reload) progress for a course. */
  load: (courseId: string) => Promise<void>;
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
