// /api/assessments/[assessmentId]/attempts/[attemptId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STUDENT } from "@/server/http/handle";
import * as assessment from "@/server/controllers/assessment.controller";

export const PUT = handle(assessment.saveAnswers, STUDENT);
