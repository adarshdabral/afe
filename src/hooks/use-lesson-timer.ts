import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";

const FLUSH_MS = 20_000; // periodic flush so time survives an abrupt tab close

/**
 * Accrues active, foreground-only time on the given lesson and flushes whole
 * seconds into AppContext (FR-08 time spent). Time while the tab is hidden is
 * not counted. Flushes periodically, on visibility-hide, and on unmount / lesson
 * change. `addTimeSpent` is held in a ref so the effect only re-runs per lesson.
 */
export function useLessonTimer(lessonId: string) {
  const { addTimeSpent } = useApp();
  const addRef = useRef(addTimeSpent);
  addRef.current = addTimeSpent;

  useEffect(() => {
    if (typeof document === "undefined") return;

    let last = Date.now();
    let accMs = 0;

    const accrue = () => {
      const now = Date.now();
      if (!document.hidden) accMs += now - last;
      last = now;
    };

    const flush = () => {
      accrue();
      const secs = Math.floor(accMs / 1000);
      if (secs > 0) {
        accMs -= secs * 1000;
        addRef.current(lessonId, secs);
      }
    };

    const onVisibility = () => {
      // Count time up to the moment of hiding; don't count the hidden gap.
      accrue();
    };

    const interval = setInterval(flush, FLUSH_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      flush(); // final partial flush for this lesson
    };
  }, [lessonId]);
}
