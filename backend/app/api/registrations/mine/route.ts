// /api/registrations/mine — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, STUDENT } from "@/server/http/handle";
import * as registration from "@/server/controllers/registration.controller";

export const GET = handle(registration.mine, STUDENT);
