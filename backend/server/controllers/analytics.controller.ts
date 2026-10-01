// Analytics controllers (SRS FR-12) — ported handler bodies from
// src/lib/analytics/analytics.functions.ts. The student app pushes its progress
// snapshot via POST /progress; teacher/school/platform reads return role-scoped
// aggregates. Role + scope come from req.user (the verified JWT), never the client.

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import { getUserById } from "../services/auth.service";
import { studentIdsForTeacher, studentSchoolInfo } from "../services/registration.service";
import {
  platformAnalytics,
  recordSnapshot,
  schoolAnalytics,
  teacherAnalytics,
} from "../services/analytics.service";

const FALLBACK_SCHOOL = { schoolName: "Independent", className: "10" };

const syncSchema = z.object({
  lessonsCompleted: z.number().int().min(0),
  lessonsTotal: z.number().int().min(0),
  modulesCompleted: z.number().int().min(0),
  modulesTotal: z.number().int().min(0),
  assessmentsPassed: z.number().int().min(0),
  avgScorePct: z.number().nullable(),
  totalTimeSec: z.number().int().min(0),
  moduleScores: z.record(z.number()),
  certificateIssued: z.boolean(),
});

/** POST /api/analytics/progress — student pushes their own progress snapshot. */
export async function sync(req: Request, res: Response): Promise<void> {
  const data = syncSchema.parse(req.body);
  const user = req.user!;
  const info = (await studentSchoolInfo(user.id)) ?? FALLBACK_SCHOOL;
  const principal = await getUserById(user.id);
  await recordSnapshot({
    studentUserId: user.id,
    studentName: principal?.name ?? "",
    schoolName: info.schoolName,
    className: info.className,
    ...data,
    updatedAt: new Date().toISOString(),
  });
  res.json({ data: { ok: true } });
}

/** GET /api/analytics/teacher — class performance across the teacher's assigned students. */
export async function teacher(req: Request, res: Response): Promise<void> {
  const studentIds = await studentIdsForTeacher(req.user!.id);
  const result = await teacherAnalytics(studentIds);
  res.json({ data: result });
}

/** GET /api/analytics/school — participation/completion for a school (by schoolName). */
export async function school(req: Request, res: Response): Promise<void> {
  const schoolName = z.string().optional().parse(req.query.schoolName) ?? "";
  const result = await schoolAnalytics(schoolName);
  res.json({ data: result });
}

/** GET /api/analytics/platform — national totals + per-school summary. */
export async function platform(_req: Request, res: Response): Promise<void> {
  const result = await platformAnalytics();
  res.json({ data: result });
}
