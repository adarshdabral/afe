// /api/progress/[courseId]/visit — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STUDENT } from "@/server/http/handle";
import * as progress from "@/server/controllers/progress.controller";

export const POST = handle(progress.visit, STUDENT);
