// /api/admin/courses/[courseId]/unpublish — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as course from "@/server/controllers/course.controller";

export const POST = handle(course.unpublish, ADMIN);
