// /api/auth/logout — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER } from "@/server/http/handle";
import * as auth from "@/server/controllers/auth.controller";

export const POST = handle(auth.logout, ANY_USER);
