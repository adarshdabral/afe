// /api/courses/[slug]/topics/[topicId]/download — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER } from "@/server/http/handle";
import * as course from "@/server/controllers/course.controller";

export const GET = handle(course.downloadTopic, ANY_USER);
