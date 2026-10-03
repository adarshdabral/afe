// /api/admin/uploads/config — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as upload from "@/server/controllers/upload.controller";

export const GET = handle(upload.config, ADMIN);
