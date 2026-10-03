// Server-only course loading for the public landing pages (SSR + metadata). Calls
// the backend API as an anonymous viewer, so only published content is returned.
// Returns null on any failure (backend asleep/unreachable); the client components
// then fetch in the browser.

import { cache } from "react";
import type { CourseListResult, CourseTree } from "@/lib/api/courses";
import { BACKEND_URL } from "@/lib/backend";
import { FLAGSHIP_SLUG, toCourseOutline, type CourseOutline } from "@/lib/course";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** The outline for `slug` (deduplicated per request between page + metadata). */
export const getCourseOutline = cache(async (slug: string): Promise<CourseOutline | null> => {
  const tree = await getJson<CourseTree>(`/courses/${encodeURIComponent(slug)}`);
  if (!tree) return null;
  try {
    return toCourseOutline(tree);
  } catch (err) {
    // Never let an unexpected backend payload crash server rendering.
    console.error("[course] could not read course outline:", err);
    return null;
  }
});

/**
 * The flagship course's slug: "demystifying-ai-for-everyone" when it is published, otherwise
 * the first published course (e.g. if an admin renamed the slug). Falls back to
 * the canonical slug when the backend is unreachable.
 */
export const resolveFlagshipSlug = cache(async (): Promise<string> => {
  if (await getCourseOutline(FLAGSHIP_SLUG)) return FLAGSHIP_SLUG;
  const list = await getJson<CourseListResult>("/courses?pageSize=1");
  return list?.courses[0]?.slug ?? FLAGSHIP_SLUG;
});
