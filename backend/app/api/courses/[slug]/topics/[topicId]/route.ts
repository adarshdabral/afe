// /api/courses/[slug]/topics/[topicId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, OPTIONAL_USER } from "@/server/http/handle";
import * as course from "@/server/controllers/course.controller";

export const GET = handle(course.publicGetTopic, OPTIONAL_USER);
