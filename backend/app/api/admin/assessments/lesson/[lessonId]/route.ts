// /api/admin/assessments/lesson/[lessonId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as assessment from "@/server/controllers/assessment.controller";

export const GET = handle(assessment.getForLesson, ADMIN);
