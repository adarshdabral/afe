// Review controllers (Phase 2E). Identity comes from `req.user` (JWT); the
// rating is validated 1–5 by zod, duplicates and ownership are enforced in the
// service. Aggregates are recomputed automatically on every mutation.

import type { Request, Response } from "express";
import { z } from "zod";
import {
  createReview,
  updateReview,
  deleteReview,
  getCourseReviews,
} from "../services/review.service";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().default(""),
});

/** GET /api/courses/:courseId/reviews — aggregate + recent reviews (+ mine). Public. */
export async function list(req: Request, res: Response): Promise<void> {
  const courseId = z.string().min(1).parse(req.params.courseId);
  const result = await getCourseReviews(courseId, req.user?.id);
  res.json({ data: result });
}

/** POST /api/courses/:courseId/reviews — add a review (auth). */
export async function add(req: Request, res: Response): Promise<void> {
  const courseId = z.string().min(1).parse(req.params.courseId);
  const data = bodySchema.parse(req.body);
  try {
    const review = await createReview({
      courseId,
      userId: req.user!.id,
      rating: data.rating,
      comment: data.comment,
    });
    res.status(201).json({ data: review });
  } catch (e) {
    if ((e as { code?: string }).code === "DUPLICATE") {
      res.status(409).json({ error: { message: (e as Error).message } });
      return;
    }
    throw e;
  }
}

/** PUT /api/reviews/:id — edit own review (auth, owner). */
export async function edit(req: Request, res: Response): Promise<void> {
  const id = z.string().min(1).parse(req.params.id);
  const data = bodySchema.parse(req.body);
  try {
    const review = await updateReview({ id, userId: req.user!.id, rating: data.rating, comment: data.comment });
    res.json({ data: review });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") return void res.status(404).json({ error: { message: (e as Error).message } });
    if (code === "FORBIDDEN") return void res.status(403).json({ error: { message: (e as Error).message } });
    throw e;
  }
}

/** DELETE /api/reviews/:id — delete own review (auth, owner). */
export async function remove(req: Request, res: Response): Promise<void> {
  const id = z.string().min(1).parse(req.params.id);
  try {
    await deleteReview({ id, userId: req.user!.id });
    res.json({ data: { ok: true } });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") return void res.status(404).json({ error: { message: (e as Error).message } });
    if (code === "FORBIDDEN") return void res.status(403).json({ error: { message: (e as Error).message } });
    throw e;
  }
}
