// /api/admin/assessments/[assessmentId]/publish — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as assessment from "@/server/controllers/assessment.controller";

export const POST = handle(assessment.publish, ADMIN);
