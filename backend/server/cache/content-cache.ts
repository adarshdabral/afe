// In-process cache for course CONTENT reads (the published course tree, the
// progress topic sequence). Content changes rarely and only through the CMS, while
// every learner page reads it — so a cached read saves several database round trips.
//
// Correctness: every content model registers `invalidateOnWrite(schema)`, which bumps
// a global version after ANY write (save, update*, delete*, insertMany) and drops
// all entries. A read that was in flight while a write committed is not stored
// (its start version is stale). Entries also expire after TTL_MS, which bounds
// staleness for writes made outside this process (scripts, another instance).
// State lives on globalThis so every copy of this module (Next.js bundles, harness
// imports) shares one cache.

import type { Schema } from "mongoose";

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

interface Entry {
  value: unknown;
  expires: number;
}
interface CacheState {
  version: number;
  entries: Map<string, Entry>;
}

const g = globalThis as typeof globalThis & { __afeContentCache?: CacheState };
const state: CacheState = (g.__afeContentCache ??= { version: 0, entries: new Map() });

/** Drop everything (called after every content write). */
export function invalidateContentCache(): void {
  state.version += 1;
  state.entries.clear();
}

/**
 * Return the cached value for `key`, or compute + store it. Callers must treat the
 * returned value as read-only (it is shared between requests).
 */
export async function cachedContent<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = state.entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const startVersion = state.version;
  const value = await compute();
  if (state.version === startVersion && value !== null && value !== undefined) {
    if (state.entries.size >= MAX_ENTRIES) state.entries.clear();
    state.entries.set(key, { value, expires: Date.now() + TTL_MS });
  }
  return value;
}

const WRITE_QUERIES = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const;

/** Invalidate the content cache after any write through this schema's model. */
export function invalidateOnWrite(schema: Schema): void {
  schema.post("save", invalidateContentCache);
  schema.post("deleteOne", { document: true, query: false }, invalidateContentCache);
  schema.post("insertMany", invalidateContentCache);
  for (const op of WRITE_QUERIES) schema.post(op, invalidateContentCache);
}
