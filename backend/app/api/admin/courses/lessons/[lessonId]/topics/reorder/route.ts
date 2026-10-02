// /api/admin/courses/lessons/[lessonId]/topics/reorder — reorder a lesson's topics.
import { handle, ADMIN } from "@/server/http/handle";
import * as topic from "@/server/controllers/topic.controller";

export const POST = handle(topic.reorder, ADMIN);
