// /api/admin/teachers — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as teacher from "@/server/controllers/teacher.controller";

export const GET = handle(teacher.list, ADMIN);
export const POST = handle(teacher.create, ADMIN);
