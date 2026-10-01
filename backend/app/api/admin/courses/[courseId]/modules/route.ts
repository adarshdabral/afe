// /api/admin/courses/[courseId]/modules — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as module from "@/server/controllers/module.controller";

export const POST = handle(module.create, ADMIN);
