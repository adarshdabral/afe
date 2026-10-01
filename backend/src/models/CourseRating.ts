// CourseRating — the per-course rating aggregate (the spec's "store aggregates":
// rating + totalReviews). Recomputed automatically from the Review collection on
// every review create/update/delete. Kept as a persisted rollup so reads are a
// single document lookup rather than an aggregation each time.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export interface CourseRatingView {
  courseId: string;
  averageRating: number;
  totalReviews: number;
}

const courseRatingSchema = new Schema(
  {
    courseId: { type: String, required: true, unique: true, index: true },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    updatedAt: { type: String, required: true },
  },
  { _id: true },
);

export type CourseRatingSchemaType = InferSchemaType<typeof courseRatingSchema>;
export type CourseRatingDoc = HydratedDocument<CourseRatingSchemaType>;

export const CourseRating = model("CourseRating", courseRatingSchema);

export function toCourseRating(courseId: string, doc: CourseRatingDoc | null): CourseRatingView {
  return {
    courseId,
    averageRating: doc?.averageRating ?? 0,
    totalReviews: doc?.totalReviews ?? 0,
  };
}
