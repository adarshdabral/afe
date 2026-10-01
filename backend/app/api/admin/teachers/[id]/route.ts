// /api/admin/teachers/[id] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as teacher from "@/server/controllers/teacher.controller";

export const GET = handle(teacher.get, ADMIN);
export const PATCH = handle(teacher.update, ADMIN);
