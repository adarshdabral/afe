// Server-only course fetch for the public landing pages (SSR + metadata). Calls
// the API on INTERNAL_API_URL — like middleware.ts — so it never depends on the
// public hostname/TLS. Anonymous request → the API returns published content only.
// Returns null on any failure; the client components then fetch in the browser.

import { cache } from "react";
import type { CourseListResult, CourseTree } from "@/lib/api/courses";
import { FLAGSHIP_SLUG, toCourseOutline, type CourseOutline } from "@/lib/course";

const API_BASE = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000/api";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
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
  return tree ? toCourseOutline(tree) : null;
});

/**
 * The flagship course's slug: "ai-for-everyone" when it is published, otherwise
 * the first published course (e.g. if an admin renamed the slug). Falls back to
 * the canonical slug when the API is unreachable.
 */
export const resolveFlagshipSlug = cache(async (): Promise<string> => {
  if (await getCourseOutline(FLAGSHIP_SLUG)) return FLAGSHIP_SLUG;
  const list = await getJson<CourseListResult>("/courses?pageSize=1");
  return list?.courses[0]?.slug ?? FLAGSHIP_SLUG;
});
