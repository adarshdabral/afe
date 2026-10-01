// /api/admin/courses/[courseId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as course from "@/server/controllers/course.controller";

export const GET = handle(course.getTree, ADMIN);
export const PATCH = handle(course.update, ADMIN);
export const DELETE = handle(course.remove, ADMIN);
