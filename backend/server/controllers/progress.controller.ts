// Progress controllers (student-scoped). All mounted behind requireRole("student").

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import {
  addTimeSpent,
  getProgress,
  listStudentProgress,
  markLessonComplete,
  setLastVisited,
} from "../services/progress.service";

const courseIdSchema = z.string().min(1);
const lessonIdSchema = z.string().min(1);

/** GET /api/progress — all of the student's course progress (dashboard). */
export async function mine(req: Request, res: Response): Promise<void> {
  res.json({ data: await listStudentProgress(req.user!.id) });
}

/** GET /api/progress/:courseId — progress + next unlocked lesson. */
export async function forCourse(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  res.json({ data: await getProgress(req.user!.id, courseId) });
}

/** POST /api/progress/:courseId/lessons/:lessonId/complete — sequential rule. */
export async function completeLesson(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  const lessonId = lessonIdSchema.parse(req.params.lessonId);
  const result = await markLessonComplete(req.user!.id, courseId, lessonId);
  if (!result.ok) {
    if (result.reason === "not_found") {
      res.status(404).json({ error: { message: "Lesson not found in this course." } });
    } else {
      res.status(409).json({ error: { message: "Complete the previous lesson first." } });
    }
    return;
  }
  res.json({ data: result.detail });
}

const visitSchema = z.object({ lessonId: z.string().min(1) });
/** POST /api/progress/:courseId/visit — remember the last-visited lesson. */
export async function visit(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  const { lessonId } = visitSchema.parse(req.body);
  res.json({ data: await setLastVisited(req.user!.id, courseId, lessonId) });
}

const timeSchema = z.object({ minutes: z.coerce.number().min(0).max(1440) });
/** POST /api/progress/:courseId/time — accumulate time spent (minutes). */
export async function time(req: Request, res: Response): Promise<void> {
  const courseId = courseIdSchema.parse(req.params.courseId);
  const { minutes } = timeSchema.parse(req.body);
  res.json({ data: await addTimeSpent(req.user!.id, courseId, minutes) });
}
