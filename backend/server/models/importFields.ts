// Fields shared by course-content models for IMPORTED content (see
// server/seed/import-course.ts). All are ADMIN-ONLY: course.service / the student
// assessment view strip them before anything reaches students or teachers.
//   importKey     — stable id from the import source (e.g. "1.1.6", "week-2-graded");
//                   unique within a course, so re-running an import never duplicates.
//   contentStatus — "needs_content" marks a shell whose source content is missing
//                   (e.g. a quiz without its question bank) so admins can find it.
//   adminNote     — why it is incomplete / facilitator notes from the source.

import type { Schema } from "mongoose";

export const CONTENT_STATUSES = ["complete", "needs_content"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ImportFieldsView {
  importKey: string | null;
  contentStatus: ContentStatus;
  adminNote: string;
}

/** Spread into a schema definition. */
export const importFieldsSchema = {
  importKey: { type: String, default: null },
  contentStatus: { type: String, enum: CONTENT_STATUSES, default: "complete" },
  adminNote: { type: String, default: "" },
} as const;

/** Unique importKey within a course (only for documents that have one). */
export function indexImportKey(schema: Schema): void {
  schema.index(
    { courseId: 1, importKey: 1 },
    { unique: true, partialFilterExpression: { importKey: { $type: "string" } }, name: "course_import_key_unique" },
  );
}

export function toImportFields(doc: { importKey?: string | null; contentStatus?: string | null; adminNote?: string | null }): ImportFieldsView {
  return {
    importKey: doc.importKey ?? null,
    contentStatus: doc.contentStatus === "needs_content" ? "needs_content" : "complete",
    adminNote: doc.adminNote ?? "",
  };
}

/** The admin-only keys — removed from every non-admin view. */
export const ADMIN_ONLY_KEYS = ["importKey", "contentStatus", "adminNote", "gradeCategory"] as const;

/** A copy without the admin-only fields. */
export function withoutAdminFields<T extends object>(v: T): Omit<T, (typeof ADMIN_ONLY_KEYS)[number]> {
  const out = { ...v } as Record<string, unknown>;
  for (const k of ADMIN_ONLY_KEYS) delete out[k];
  return out as Omit<T, (typeof ADMIN_ONLY_KEYS)[number]>;
}
