"use client";

import { useEffect, useRef } from "react";

/**
 * Lesson time tracker. While `enabled`, it runs a 30-second heartbeat that reports
 * newly-elapsed WHOLE minutes via `onMinutes` (so the server's minute counter stays
 * accurate — no double counting), and flushes any remaining whole minute on
 * unmount / navigation. The callback identity may change freely (kept in a ref),
 * so the timer only (re)starts when `enabled` flips.
 */
export function useLessonTimer(enabled: boolean, onMinutes: (minutes: number) => void): void {
  const cb = useRef(onMinutes);
  cb.current = onMinutes;

  useEffect(() => {
    if (!enabled) return;
    const start = Date.now();
    let reported = 0;

    const flush = () => {
      const elapsedMin = Math.floor((Date.now() - start) / 60000);
      const delta = elapsedMin - reported;
      if (delta >= 1) {
        reported = elapsedMin;
        cb.current(delta);
      }
    };

    const id = setInterval(flush, 30_000); // heartbeat every 30s
    return () => {
      clearInterval(id);
      flush(); // persist the final partial interval's whole minutes on unmount
    };
  }, [enabled]);
}
