// /api/admin/courses/modules/[moduleId]/lessons — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as lesson from "@/server/controllers/lesson.controller";

export const POST = handle(lesson.create, ADMIN);
