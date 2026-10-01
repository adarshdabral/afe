// /api/forum/threads/[id] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER } from "@/server/http/handle";
import * as forum from "@/server/controllers/forum.controller";

export const GET = handle(forum.get, ANY_USER);
