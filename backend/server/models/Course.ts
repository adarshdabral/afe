// Course model (Course CMS). Top of the content hierarchy: Course → Module →
// Lesson. Only a platform admin mutates courses. Courses are SOFT-deleted
// (`deletedAt`) so content is never destroyed. `slug` is unique and is the public
// lookup key.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;
export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export interface CourseView {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  instructor: string;
  thumbnail: string;
  bannerImage: string;
  status: CourseStatus;
  level: CourseLevel;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  prerequisites: string[];
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    instructor: { type: String, default: "" }, // display name of the course instructor
    thumbnail: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    status: { type: String, enum: COURSE_STATUSES, default: "draft", index: true },
    level: { type: String, enum: COURSE_LEVELS, default: "beginner" },
    estimatedDurationMinutes: { type: Number, default: 0 },
    learningObjectives: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    // Soft delete — a non-null timestamp hides the course everywhere.
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export type CourseSchemaType = InferSchemaType<typeof courseSchema>;
export type CourseDoc = HydratedDocument<CourseSchemaType>;

export const Course = defineModel("Course", courseSchema);

export function toCourse(doc: CourseDoc): CourseView {
  const ts = doc as unknown as { createdAt?: Date; updatedAt?: Date };
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    description: doc.description ?? "",
    shortDescription: doc.shortDescription ?? "",
    instructor: (doc as { instructor?: string }).instructor ?? "",
    thumbnail: doc.thumbnail ?? "",
    bannerImage: doc.bannerImage ?? "",
    status: doc.status as CourseStatus,
    level: doc.level as CourseLevel,
    estimatedDurationMinutes: doc.estimatedDurationMinutes ?? 0,
    learningObjectives: doc.learningObjectives ?? [],
    prerequisites: doc.prerequisites ?? [],
    tags: doc.tags ?? [],
    createdBy: doc.createdBy,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
