// /api/auth/me — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, OPTIONAL_USER } from "@/server/http/handle";
import * as auth from "@/server/controllers/auth.controller";

export const GET = handle(auth.me, OPTIONAL_USER);
