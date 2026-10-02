// /api/admin/courses/[courseId]/sections/[kind] — edit a course section's content
// (kind: introduction | overview | instructor).
import { handle, ADMIN } from "@/server/http/handle";
import * as section from "@/server/controllers/section.controller";

export const PATCH = handle(section.update, ADMIN);
