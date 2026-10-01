// /api/analytics/teacher — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STAFF } from "@/server/http/handle";
import * as analytics from "@/server/controllers/analytics.controller";

export const GET = handle(analytics.teacher, STAFF);
