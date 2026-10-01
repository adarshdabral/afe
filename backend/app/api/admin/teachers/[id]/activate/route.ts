// /api/admin/teachers/[id]/activate — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as teacher from "@/server/controllers/teacher.controller";

export const POST = handle(teacher.activate, ADMIN);
