// /api/admin/courses/topics/[topicId] — edit / delete a topic (learning unit).
import { handle, ADMIN } from "@/server/http/handle";
import * as topic from "@/server/controllers/topic.controller";

export const PATCH = handle(topic.update, ADMIN);
export const DELETE = handle(topic.remove, ADMIN);
