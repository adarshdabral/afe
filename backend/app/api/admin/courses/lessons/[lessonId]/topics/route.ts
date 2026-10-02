// /api/admin/courses/lessons/[lessonId]/topics — add a topic to a lesson.
import { handle, ADMIN } from "@/server/http/handle";
import * as topic from "@/server/controllers/topic.controller";

export const POST = handle(topic.create, ADMIN);
