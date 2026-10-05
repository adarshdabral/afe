"use client";

// Client-side data for the /learn pages. The course outline and topic bodies are
// kept in a module-level cache shared by every learn page, so moving between
// topics/modules renders instantly instead of re-downloading the course each time.
// Stale-while-revalidate: cached data is shown at once and refreshed in the
// background once it is older than FRESH_MS. Failed fetches are never cached.

import { useEffect, useState } from "react";
import { getPublicCourse, getPublicTopic, type CourseTree, type TopicInCourse } from "@/lib/api/courses";
import { useLearning } from "@/context/LearningContext";

const FRESH_MS = 30_000;

interface Entry<T> {
  value?: T;
  at: number;
  inflight?: Promise<T>;
}
const store = new Map<string, Entry<unknown>>();

function peek<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined;
}

/** Fetch (deduplicated) and store; rejects on failure without caching it. */
function fetchInto<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = (store.get(key) ?? { at: 0 }) as Entry<T>;
  if (entry.inflight) return entry.inflight;
  const p = fetcher()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => {
      const e = store.get(key);
      if (e?.inflight === p) delete e.inflight;
    });
  store.set(key, { ...entry, inflight: p });
  return p;
}

/** Cached value now (if any) + a fresh one via `onFresh` when stale or missing. */
function revalidate<T>(key: string, fetcher: () => Promise<T>, onFresh: (v: T) => void, onError: (err: unknown) => void): void {
  const e = store.get(key) as Entry<T> | undefined;
  if (e?.value !== undefined && Date.now() - e.at < FRESH_MS) return;
  fetchInto(key, fetcher).then(onFresh, (err) => {
    if (peek(key) === undefined) onError(err); // keep showing cached data on refresh failure
  });
}

/** Why a fetch failed: HTTP status (403 = locked for this student) + the server's message. */
export interface LoadError {
  status: number | null;
  message: string;
}
const loadError = (err: unknown): LoadError => ({
  status: (err as { response?: { status?: number } })?.response?.status ?? null,
  message: err instanceof Error ? err.message : "Could not load.",
});

const treeKey = (slug: string) => `tree:${slug}`;
const topicKey = (slug: string, topicId: string) => `topic:${slug}:${topicId}`;
const loadTree = (slug: string) => () => getPublicCourse(slug, "outline");
const loadTopic = (slug: string, topicId: string) => () => getPublicTopic(slug, topicId);

const hintKey = (slug: string) => `afe:course-id:${slug}`;
function readCourseIdHint(slug: string): string | null {
  try {
    return localStorage.getItem(hintKey(slug));
  } catch {
    return null;
  }
}
function writeCourseIdHint(slug: string, id: string): void {
  try {
    localStorage.setItem(hintKey(slug), id);
  } catch {
    /* storage unavailable — the hint is only an optimisation */
  }
}

/** Warm the cache for a topic the learner is likely to open next. */
export function prefetchTopic(slug: string, topicId: string | null | undefined): void {
  if (!topicId || peek(topicKey(slug, topicId)) !== undefined) return;
  fetchInto(topicKey(slug, topicId), loadTopic(slug, topicId)).catch(() => {});
}

/**
 * The course outline (topic bodies omitted) + the student's progress for it.
 * `status` is "ready" once the outline is known and progress has been fetched once
 * for this course (instant on every navigation after the first).
 */
export function useLearnCourse(slug: string): { tree: CourseTree | null; status: "loading" | "error" | "ready" } {
  const { load, loadedCourseId } = useLearning();
  const [tree, setTree] = useState<CourseTree | null>(() => peek<CourseTree>(treeKey(slug)) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const cached = peek<CourseTree>(treeKey(slug));
    setTree(cached ?? null);
    setFailed(false);
    revalidate(treeKey(slug), loadTree(slug), (t) => live && setTree(t), () => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [slug]);

  // Start the progress fetch in parallel with the outline on a first visit, using the
  // course id remembered from a previous visit (corrected once the outline arrives).
  useEffect(() => {
    if (peek(treeKey(slug))) return;
    const hinted = readCourseIdHint(slug);
    if (hinted) void load(hinted);
  }, [slug, load]);

  const courseId = tree?.id;
  useEffect(() => {
    if (!courseId) return;
    writeCourseIdHint(slug, courseId);
    void load(courseId); // no-op while fresh; otherwise refreshes in the background
  }, [slug, courseId, load]);

  const status = failed && !tree ? "error" : tree && loadedCourseId === tree.id ? "ready" : "loading";
  return { tree, status };
}

/** One topic's full content (cached; the next topic is prefetched by the caller).
 *  `reload()` refetches — e.g. after completing the previous item unlocks it. */
export function useLearnTopic(
  slug: string,
  topicId: string,
): { data: TopicInCourse | null; error: LoadError | null; reload: () => void } {
  const [data, setData] = useState<TopicInCourse | null>(() => peek<TopicInCourse>(topicKey(slug, topicId)) ?? null);
  const [error, setError] = useState<LoadError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setData(peek<TopicInCourse>(topicKey(slug, topicId)) ?? null);
    setError(null);
    revalidate(topicKey(slug, topicId), loadTopic(slug, topicId), (d) => live && setData(d), (err) => live && setError(loadError(err)));
    return () => {
      live = false;
    };
  }, [slug, topicId, nonce]);

  return { data, error, reload: () => setNonce((n) => n + 1) };
}
