// Frontend reviews service (Phase 2E) — course reviews & ratings via the Express API.

import { api } from "./axios";

export interface Review {
  id: string;
  rating: number;
  comment: string;
  userId: string;
  userName: string;
  courseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RatingAggregate {
  courseId: string;
  averageRating: number;
  totalReviews: number;
}

export interface CourseReviews {
  aggregate: RatingAggregate;
  reviews: Review[];
  mine: Review | null;
}

export interface ReviewInput {
  rating: number;
  comment: string;
}

/** Aggregate + recent reviews (+ the signed-in user's own review). */
export async function listReviews(courseId: string): Promise<CourseReviews> {
  const { data } = await api.get<{ data: CourseReviews }>(
    `/courses/${encodeURIComponent(courseId)}/reviews`,
  );
  return data.data;
}

export async function addReview(courseId: string, input: ReviewInput): Promise<Review> {
  const { data } = await api.post<{ data: Review }>(
    `/courses/${encodeURIComponent(courseId)}/reviews`,
    input,
  );
  return data.data;
}

export async function updateReview(id: string, input: ReviewInput): Promise<Review> {
  const { data } = await api.put<{ data: Review }>(`/reviews/${encodeURIComponent(id)}`, input);
  return data.data;
}

export async function deleteReview(id: string): Promise<void> {
  await api.delete(`/reviews/${encodeURIComponent(id)}`);
}
