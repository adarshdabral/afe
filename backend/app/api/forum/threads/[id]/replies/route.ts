// /api/forum/threads/[id]/replies — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER } from "@/server/http/handle";
import * as forum from "@/server/controllers/forum.controller";

export const POST = handle(forum.reply, ANY_USER);
