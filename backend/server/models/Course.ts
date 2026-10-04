// Course model (Course CMS). Top of the content hierarchy: Course → (Introduction,
// Overview, Meet the Instructor sections) + Module → Lesson → Topic. Only a platform admin mutates courses. Courses are SOFT-deleted
// (`deletedAt`) so content is never destroyed. `slug` is unique and is the public
// lookup key.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";
import { invalidateOnWrite } from "../cache/content-cache";

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;
export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** The institution offering the course ("Offered by" on the course page). */
export interface OfferedBy {
  name: string;
  logoUrl: string;
  description: string;
  url: string;
}

export interface CourseView {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  instructor: string;
  /** Short credential line shown with the instructor badge, e.g. "Professor, …". */
  instructorTitle: string;
  thumbnail: string;
  bannerImage: string;
  status: CourseStatus;
  level: CourseLevel;
  estimatedDurationMinutes: number;
  learningObjectives: string[];
  prerequisites: string[];
  tags: string[];
  /** "Skills you'll gain" chips. */
  skills: string[];
  /** "Tools you'll learn" chips. */
  tools: string[];
  offeredBy: OfferedBy;
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
    instructorTitle: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    status: { type: String, enum: COURSE_STATUSES, default: "draft", index: true },
    level: { type: String, enum: COURSE_LEVELS, default: "beginner" },
    estimatedDurationMinutes: { type: Number, default: 0 },
    learningObjectives: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    tools: { type: [String], default: [] },
    offeredBy: {
      name: { type: String, default: "" },
      logoUrl: { type: String, default: "" },
      description: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    createdBy: { type: String, required: true },
    // Soft delete — a non-null timestamp hides the course everywhere.
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export type CourseSchemaType = InferSchemaType<typeof courseSchema>;
export type CourseDoc = HydratedDocument<CourseSchemaType>;

invalidateOnWrite(courseSchema); // course content is cached (server/cache/content-cache.ts)

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
    instructorTitle: doc.instructorTitle ?? "",
    thumbnail: doc.thumbnail ?? "",
    bannerImage: doc.bannerImage ?? "",
    status: doc.status as CourseStatus,
    level: doc.level as CourseLevel,
    estimatedDurationMinutes: doc.estimatedDurationMinutes ?? 0,
    learningObjectives: doc.learningObjectives ?? [],
    prerequisites: doc.prerequisites ?? [],
    tags: doc.tags ?? [],
    skills: [...(doc.skills ?? [])],
    tools: [...(doc.tools ?? [])],
    offeredBy: {
      name: doc.offeredBy?.name ?? "",
      logoUrl: doc.offeredBy?.logoUrl ?? "",
      description: doc.offeredBy?.description ?? "",
      url: doc.offeredBy?.url ?? "",
    },
    createdBy: doc.createdBy,
    createdAt: ts.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: ts.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}
