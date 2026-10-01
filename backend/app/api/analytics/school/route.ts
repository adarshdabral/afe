// /api/analytics/school — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as analytics from "@/server/controllers/analytics.controller";

export const GET = handle(analytics.school, ADMIN);
