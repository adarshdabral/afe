// /api/analytics/progress — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STUDENT } from "@/server/http/handle";
import * as analytics from "@/server/controllers/analytics.controller";

export const POST = handle(analytics.sync, STUDENT);
