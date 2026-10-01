// /api/admin/assessments/[assessmentId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as assessment from "@/server/controllers/assessment.controller";

export const GET = handle(assessment.getAdmin, ADMIN);
export const PATCH = handle(assessment.update, ADMIN);
export const DELETE = handle(assessment.remove, ADMIN);
