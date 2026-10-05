// Progress controllers (student-scoped). All mounted behind requireRole("student").

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import {
  addTimeSpent,
  getProgress,
  listStudentProgress,
  markTopicComplete,
  setLastVisited,
} from "../services/progress.service";

const courseIdSchema = z.string().min(1);
const topicIdSchema = z.string().min(1);

/** GET /api/progress — all of the student's course progress (dashboard). */
export async function mine(req: Request, res: Response): Promise<void> {
  res.json({ data: await listStudentProgress(req.user!.id) });
}

/** GET /api/progress/:courseId — progress + next unlocked topic. */
export async function forCourse(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  res.json({ data: await getProgress(req.user!.id, courseId) });
}

/** POST /api/progress/:courseId/topics/:topicId/complete — sequential rule. */
export async function completeTopic(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  const topicId = topicIdSchema.parse(req.params.topicId);
  const result = await markTopicComplete(req.user!.id, courseId, topicId);
  if (!result.ok) {
    if (result.reason === "not_found") {
      res.status(404).json({ error: { message: "Topic not found in this course." } });
    } else {
      // locked (sequence / module lock) or a required discussion without a post
      res.status(409).json({ error: { message: result.message ?? "Complete the previous topic first." } });
    }
    return;
  }
  res.json({ data: result.detail });
}

const visitSchema = z.object({ topicId: z.string().min(1) });
/** POST /api/progress/:courseId/visit — remember the last-visited topic. */
export async function visit(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  const { topicId } = visitSchema.parse(req.body);
  res.json({ data: await setLastVisited(req.user!.id, courseId, topicId) });
}

const timeSchema = z.object({ minutes: z.coerce.number().min(0).max(1440) });
/** POST /api/progress/:courseId/time — accumulate time spent (minutes). */
export async function time(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  const { minutes } = timeSchema.parse(req.body);
  res.json({ data: await addTimeSpent(req.user!.id, courseId, minutes) });
}
