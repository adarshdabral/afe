// /api/certificates/verify/[certificateId] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle } from "@/server/http/handle";
import * as certificate from "@/server/controllers/certificate.controller";

export const GET = handle(certificate.verify);
