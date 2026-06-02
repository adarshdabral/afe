// Analytics RPC surface (SRS FR-12). The student app pushes its progress
// snapshot via `syncMyProgressFn`; teacher/school/platform reads return
// role-scoped aggregates. Role + scope come from the session, never the client.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { useAppSession as resolveSession } from "@/lib/auth/session.server";
import type { CurrentUser } from "@/lib/auth/auth.functions";
import type { Role } from "@/lib/auth/access";
import { studentSchoolInfo, teacherSchoolIds } from "@/lib/auth/registrations.server";
import {
  platformAnalytics,
  recordSnapshot,
  schoolAnalytics,
  schoolForAdmin,
  teacherAnalytics,
} from "./analytics.server";

async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = (await resolveSession()).data.user;
  if (!user) throw new Error("Not authenticated.");
  if (roles && !roles.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

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

/** Student pushes their own progress snapshot; server enriches with school/class. */
export const syncMyProgressFn = createServerFn({ method: "POST" })
  .inputValidator(syncSchema)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const user = await requireUser(["student"]);
    const info = studentSchoolInfo(user.id) ?? FALLBACK_SCHOOL;
    recordSnapshot({
      studentUserId: user.id,
      studentName: user.name,
      schoolId: info.schoolId,
      schoolName: info.schoolName,
      className: info.className,
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  });

/** Teacher: class performance + completion + assessment trend for their school(s). */
export const teacherAnalyticsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser(["teacher", "platform_admin"]);
  return teacherAnalytics(teacherSchoolIds(user.id));
});

/** School admin: participation, completion, engagement for their school. */
export const schoolAnalyticsFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ schoolId: z.string().optional() }))
  .handler(async ({ data }) => {
    const user = await requireUser(["school_admin", "platform_admin"]);
    const schoolId = data.schoolId ?? schoolForAdmin(user.id);
    return schoolAnalytics(schoolId);
  });

/** Platform admin: national totals + per-school summary. */
export const platformAnalyticsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser(["platform_admin"]);
  return platformAnalytics();
});
