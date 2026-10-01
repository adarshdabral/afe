"use client";

import { useEffect, useState } from "react";
import { getPublicCourse } from "@/lib/api/courses";
import { toCourseOutline, type CourseOutline } from "@/lib/course";

export type OutlineState =
  | { status: "ready"; course: CourseOutline }
  | { status: "loading" | "missing"; course: null };

/** Use the server-rendered outline when present; otherwise fetch it in the
 *  browser (e.g. the server couldn't reach the API during SSR). */
export function useCourseOutline(slug: string, initial: CourseOutline | null): OutlineState {
  const [state, setState] = useState<OutlineState>(
    initial ? { status: "ready", course: initial } : { status: "loading", course: null },
  );

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    getPublicCourse(slug)
      .then((t) => !cancelled && setState({ status: "ready", course: toCourseOutline(t) }))
      .catch(() => !cancelled && setState({ status: "missing", course: null }));
    return () => {
      cancelled = true;
    };
  }, [slug, initial]);

  return state;
}
