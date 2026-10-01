// /api/forum/posts/[id]/moderate — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STAFF } from "@/server/http/handle";
import * as forum from "@/server/controllers/forum.controller";

export const POST = handle(forum.moderatePost, STAFF);
