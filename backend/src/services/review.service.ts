// Review service (Phase 2E). CRUD for course reviews + automatic recomputation
// of the per-course rating aggregate after every mutation.

import { Review, toReview, type ReviewView } from "../models/Review";
import { CourseRating, toCourseRating, type CourseRatingView } from "../models/CourseRating";
import { User } from "../models/User";

const RECENT_LIMIT = 20;

function nowIso(): string {
  return new Date().toISOString();
}

/** Recompute + persist the course's rating aggregate from its reviews. */
export async function recomputeAggregate(courseId: string): Promise<CourseRatingView> {
  const rows = await Review.aggregate<{ _id: string; avg: number; count: number }>([
    { $match: { courseId } },
    { $group: { _id: "$courseId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const averageRating = rows.length ? Math.round(rows[0].avg * 10) / 10 : 0;
  const totalReviews = rows.length ? rows[0].count : 0;
  await CourseRating.findOneAndUpdate(
    { courseId },
    { courseId, averageRating, totalReviews, updatedAt: nowIso() },
    { upsert: true },
  );
  return { courseId, averageRating, totalReviews };
}

export async function getAggregate(courseId: string): Promise<CourseRatingView> {
  const doc = await CourseRating.findOne({ courseId });
  return toCourseRating(courseId, doc);
}

export interface ReviewWithAuthor extends ReviewView {
  userName: string;
}

async function withAuthorNames(reviews: ReviewView[]): Promise<ReviewWithAuthor[]> {
  const ids = [...new Set(reviews.map((r) => r.userId))];
  const users = await User.find({ _id: { $in: ids } }).select("name");
  const nameById = new Map(users.map((u) => [String(u._id), u.name as string]));
  return reviews.map((r) => ({ ...r, userName: nameById.get(r.userId) ?? "User" }));
}

/** Recent reviews + aggregate (+ the viewer's own review when authenticated). */
export async function getCourseReviews(
  courseId: string,
  viewerUserId?: string,
): Promise<{
  aggregate: CourseRatingView;
  reviews: ReviewWithAuthor[];
  mine: ReviewWithAuthor | null;
}> {
  const docs = await Review.find({ courseId }).sort({ createdAt: -1 }).limit(RECENT_LIMIT);
  const reviews = await withAuthorNames(docs.map(toReview));
  const aggregate = await getAggregate(courseId);
  const mine = viewerUserId ? (reviews.find((r) => r.userId === viewerUserId) ?? null) : null;
  return { aggregate, reviews, mine };
}

/** Add a review. Throws DUPLICATE if the user already reviewed this course. */
export async function createReview(input: {
  courseId: string;
  userId: string;
  rating: number;
  comment: string;
}): Promise<ReviewView> {
  const existing = await Review.findOne({ courseId: input.courseId, userId: input.userId });
  if (existing) throw Object.assign(new Error("You have already reviewed this course."), { code: "DUPLICATE" });
  const ts = nowIso();
  try {
    const doc = await Review.create({
      courseId: input.courseId,
      userId: input.userId,
      rating: input.rating,
      comment: input.comment,
      createdAt: ts,
      updatedAt: ts,
    });
    await recomputeAggregate(input.courseId);
    return toReview(doc);
  } catch (e) {
    // Unique-index race → duplicate.
    if ((e as { code?: number }).code === 11000) {
      throw Object.assign(new Error("You have already reviewed this course."), { code: "DUPLICATE" });
    }
    throw e;
  }
}

/** Edit own review. Throws NOT_FOUND / FORBIDDEN. */
export async function updateReview(input: {
  id: string;
  userId: string;
  rating: number;
  comment: string;
}): Promise<ReviewView> {
  const doc = await Review.findById(input.id);
  if (!doc) throw Object.assign(new Error("Review not found."), { code: "NOT_FOUND" });
  if (doc.userId !== input.userId)
    throw Object.assign(new Error("You can only edit your own review."), { code: "FORBIDDEN" });
  doc.rating = input.rating;
  doc.comment = input.comment;
  doc.updatedAt = nowIso();
  await doc.save();
  await recomputeAggregate(doc.courseId);
  return toReview(doc);
}

/** Delete own review. Throws NOT_FOUND / FORBIDDEN. Returns the courseId. */
export async function deleteReview(input: { id: string; userId: string }): Promise<{ courseId: string }> {
  const doc = await Review.findById(input.id);
  if (!doc) throw Object.assign(new Error("Review not found."), { code: "NOT_FOUND" });
  if (doc.userId !== input.userId)
    throw Object.assign(new Error("You can only delete your own review."), { code: "FORBIDDEN" });
  const courseId = doc.courseId;
  await doc.deleteOne();
  await recomputeAggregate(courseId);
  return { courseId };
}
