// Course sections — the three course-level content pages every course has,
// shown before its modules:
//   Course → { Course Introduction, Course Overview, Meet the Instructor } → Modules → …
// They are not modules or topics, but use the same content system as Topics
// (text, audio, PDF/PPT, video + subtitles). Exactly one per (course, kind),
// created automatically with the course (see section.service ensureSections).

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import { contentFieldsSchema, toContentFields, type ContentFieldsView } from "./content";

export const SECTION_KINDS = ["introduction", "overview", "instructor"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Default titles, in display order. */
export const SECTION_TITLES: Record<SectionKind, string> = {
  introduction: "Course Introduction",
  overview: "Course Overview",
  instructor: "Meet the Instructor",
};

export interface CourseSectionView extends ContentFieldsView {
  id: string;
  courseId: string;
  kind: SectionKind;
  title: string;
  description: string;
  order: number;
  estimatedDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

const courseSectionSchema = new Schema(
  {
    courseId: { type: String, required: true, index: true },
    kind: { type: String, enum: SECTION_KINDS, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    ...contentFieldsSchema,
    estimatedDurationMinutes: { type: Number, default: 0 },
  },
  { timestamps: true },
);
courseSectionSchema.index({ courseId: 1, kind: 1 }, { unique: true });

export type CourseSectionDoc = HydratedDocument<InferSchemaType<typeof courseSectionSchema>>;

export const CourseSection = defineModel("CourseSection", courseSectionSchema);

export function toCourseSection(doc: CourseSectionDoc): CourseSectionView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  const kind = doc.kind as SectionKind;
  return {
    id: String(doc._id),
    courseId: doc.courseId,
    kind,
    title: doc.title,
    description: doc.description ?? "",
    order: SECTION_KINDS.indexOf(kind),
    ...toContentFields(doc),
    estimatedDurationMinutes: doc.estimatedDurationMinutes ?? 0,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
