// /api/admin/courses/[courseId]/sections — the course's Introduction, Overview and Instructor sections.
import { handle, ADMIN } from "@/server/http/handle";
import * as section from "@/server/controllers/section.controller";

export const GET = handle(section.list, ADMIN);
