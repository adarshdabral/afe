// /api/admin/courses/lessons/[lessonId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as lesson from "@/server/controllers/lesson.controller";

export const PATCH = handle(lesson.update, ADMIN);
export const DELETE = handle(lesson.remove, ADMIN);
