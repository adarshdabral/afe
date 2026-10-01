// /api/progress/[courseId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STUDENT } from "@/server/http/handle";
import * as progress from "@/server/controllers/progress.controller";

export const GET = handle(progress.forCourse, STUDENT);
