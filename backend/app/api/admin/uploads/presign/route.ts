// /api/admin/uploads/presign — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as upload from "@/server/controllers/upload.controller";

export const POST = handle(upload.presign, ADMIN);
