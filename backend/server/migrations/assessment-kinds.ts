// Lesson assignments share the Assessment model with module assessments. Before
// that, `moduleId` was UNIQUE across all assessments — which would forbid a module's
// lesson assignments. This migration (idempotent, run at startup):
//   1. marks every assessment without a `kind` as a module assessment, and
//   2. replaces the old unique `moduleId_1` index with the schema's partial unique
//      indexes (one module assessment per module, one assignment per lesson).
// Existing assessments, questions, attempts and progress are untouched.

import { Assessment } from "../models/Assessment";

export async function migrateAssessmentKinds(): Promise<void> {
  const res = await Assessment.updateMany(
    { kind: { $exists: false } },
    { $set: { kind: "module", lessonId: null } },
  );
  if (res.modifiedCount > 0) console.log(`[migrate] ${res.modifiedCount} assessment(s) marked as module assessments`);

  const indexes = await Assessment.collection.indexes().catch(() => [] as { name?: string; unique?: boolean }[]);
  const legacy = indexes.find((i) => i.name === "moduleId_1" && i.unique);
  if (legacy) {
    await Assessment.collection.dropIndex("moduleId_1");
    console.log("[migrate] dropped the legacy unique index assessments.moduleId_1");
  }
  // (Re)create the schema's indexes — the non-unique moduleId_1 and the partial
  // unique ones (a no-op when they already exist).
  await Assessment.createIndexes();
}
