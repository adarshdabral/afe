// Analytics controllers (SRS FR-12) — ported handler bodies from
// src/lib/analytics/analytics.functions.ts. The student app pushes its progress
// snapshot via POST /progress; teacher/school/platform reads return role-scoped
// aggregates. Role + scope come from req.user (the verified JWT), never the client.

import type { Request, Response } from "express";
import { z } from "zod";
import { getUserById } from "../services/auth.service";
import { studentSchoolInfo, teacherSchoolIds } from "../services/registration.service";
import {
  platformAnalytics,
  recordSnapshot,
  schoolAnalytics,
  schoolForAdmin,
  teacherAnalytics,
} from "../services/analytics.service";

const FALLBACK_SCHOOL = { schoolId: "school-1", schoolName: "Doon Public School", className: "10" };

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
    schoolId: info.schoolId,
    schoolName: info.schoolName,
    className: info.className,
    ...data,
    updatedAt: new Date().toISOString(),
  });
  res.json({ data: { ok: true } });
}

/** GET /api/analytics/teacher — class performance for the teacher's school(s). */
export async function teacher(req: Request, res: Response): Promise<void> {
  const result = await teacherAnalytics(teacherSchoolIds(req.user!.id));
  res.json({ data: result });
}

/** GET /api/analytics/school — participation/completion/engagement for a school. */
export async function school(req: Request, res: Response): Promise<void> {
  const schoolId = z.string().optional().parse(req.query.schoolId) ?? schoolForAdmin(req.user!.id);
  const result = await schoolAnalytics(schoolId);
  res.json({ data: result });
}

/** GET /api/analytics/platform — national totals + per-school summary. */
export async function platform(_req: Request, res: Response): Promise<void> {
  const result = await platformAnalytics();
  res.json({ data: result });
}
