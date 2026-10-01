// Review model (Phase 2E). One review per (course, user) — enforced by a unique
// compound index so a user can't post duplicate reviews for the same course.
// NOTE: this app's reviewable entity is a course, so `courseId` is the spec's
// `storeId`.

import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "./defineModel";

export interface ReviewView {
  id: string;
  rating: number;
  comment: string;
  userId: string;
  courseId: string;
  createdAt: string;
  updatedAt: string;
}

const reviewSchema = new Schema(
  {
    courseId: { type: String, required: true },
    userId: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 2000 },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { _id: true },
);

// One review per user per course (prevents duplicate reviews).
reviewSchema.index({ courseId: 1, userId: 1 }, { unique: true });
// Recent-first listing per course.
reviewSchema.index({ courseId: 1, createdAt: -1 });

export type ReviewSchemaType = InferSchemaType<typeof reviewSchema>;
export type ReviewDoc = HydratedDocument<ReviewSchemaType>;

export const Review = defineModel("Review", reviewSchema);

export function toReview(doc: ReviewDoc): ReviewView {
  return {
    id: String(doc._id),
    rating: doc.rating,
    comment: doc.comment ?? "",
    userId: doc.userId,
    courseId: doc.courseId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
