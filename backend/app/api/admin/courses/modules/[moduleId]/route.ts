// /api/admin/courses/modules/[moduleId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as module from "@/server/controllers/module.controller";

export const PATCH = handle(module.update, ADMIN);
export const DELETE = handle(module.remove, ADMIN);
