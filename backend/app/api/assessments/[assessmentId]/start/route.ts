// /api/assessments/[assessmentId]/start — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STUDENT } from "@/server/http/handle";
import * as assessment from "@/server/controllers/assessment.controller";

export const POST = handle(assessment.start, STUDENT);
