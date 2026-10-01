// /api/admin/courses — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as course from "@/server/controllers/course.controller";

export const POST = handle(course.create, ADMIN);
export const GET = handle(course.list, ADMIN);
