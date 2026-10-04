// Server-only course loading for the public landing pages (SSR + metadata). Calls
// the backend API as an anonymous viewer, so only published content is returned.
// Returns null on any failure (backend asleep/unreachable); the client components
// then fetch in the browser.

import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { CourseListResult, CourseTree } from "@/lib/api/courses";
import { BACKEND_URL } from "@/lib/backend";
import { FLAGSHIP_SLUG, toCourseOutline, type CourseOutline } from "@/lib/course";

/** How long the landing pages reuse a backend response (seconds). Admin edits to
 *  published content reach the public landing pages within this window. */
const REVALIDATE_SECONDS = 60;

/** Fetch `/api${path}`; THROWS on any failure, so failures are never cached. */
async function fetchData<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    cache: "no-store", // caching is done by unstable_cache below (successes only)
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const json = (await res.json()) as { data?: T };
  if (json.data == null) throw new Error(`GET ${path} → empty`);
  return json.data;
}

// Cached across requests (Next.js data cache; Vercel's shared Data Cache in
// production) — the landing pages skip the backend round trip on a cache hit.
const cachedData = unstable_cache(
  async (path: string): Promise<unknown> => fetchData<unknown>(path),
  ["landing-api"],
  { revalidate: REVALIDATE_SECONDS },
);

async function getJson<T>(path: string): Promise<T | null> {
  try {
    return (await cachedData(path)) as T;
  } catch {
    return null; // backend asleep / unreachable / 404 — the client fetches instead
  }
}

/** The outline for `slug` (deduplicated per request between page + metadata). */
export const getCourseOutline = cache(async (slug: string): Promise<CourseOutline | null> => {
  const tree = await getJson<CourseTree>(`/courses/${encodeURIComponent(slug)}?view=outline`);
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
