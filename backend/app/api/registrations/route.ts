// /api/registrations — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle } from "@/server/http/handle";
import * as registration from "@/server/controllers/registration.controller";

export const POST = handle(registration.register);
