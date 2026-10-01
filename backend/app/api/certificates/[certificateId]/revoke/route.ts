// /api/certificates/[certificateId]/revoke — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ADMIN } from "@/server/http/handle";
import * as certificate from "@/server/controllers/certificate.controller";

export const POST = handle(certificate.revoke, ADMIN);
