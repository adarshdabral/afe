// /api/admin/courses/lessons/[lessonId]/items/reorder — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as topic from "@/server/controllers/topic.controller";

export const POST = handle(topic.reorderItems, ADMIN);
