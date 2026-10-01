// /api/assessments/[assessmentId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER } from "@/server/http/handle";
import * as assessment from "@/server/controllers/assessment.controller";

export const GET = handle(assessment.getStudent, ANY_USER);
