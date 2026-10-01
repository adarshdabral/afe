// /api/admin/assessments/questions/[questionId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as assessment from "@/server/controllers/assessment.controller";

export const PATCH = handle(assessment.editQuestion, ADMIN);
export const DELETE = handle(assessment.removeQuestion, ADMIN);
