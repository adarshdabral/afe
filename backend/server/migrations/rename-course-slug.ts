// Course slug rename: "ai-for-everyone" → "demystifying-ai-for-everyone".
// Renames the existing course IN PLACE (same _id), so modules, progress,
// certificates and reviews — all keyed by courseId — stay attached. Without this,
// `npm run seed` would treat the old-slug course as "another course", soft-delete
// it and build a fresh copy, cutting students off from their progress.
// Idempotent: does nothing once the new slug exists or the old one is gone.

import { Course } from "../models/Course";

export const LEGACY_FLAGSHIP_SLUG = "ai-for-everyone";
export const FLAGSHIP_SLUG = "demystifying-ai-for-everyone";

export async function renameFlagshipSlug(): Promise<boolean> {
  if (await Course.exists({ slug: FLAGSHIP_SLUG })) return false;
  const res = await Course.updateOne(
    { slug: LEGACY_FLAGSHIP_SLUG, deletedAt: null },
    { $set: { slug: FLAGSHIP_SLUG } },
  );
  if (res.modifiedCount > 0) console.log(`[migrate] course slug ${LEGACY_FLAGSHIP_SLUG} → ${FLAGSHIP_SLUG}`);
  return res.modifiedCount > 0;
}
