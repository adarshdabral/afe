// /api/certificates/[certificateId]/download — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER } from "@/server/http/handle";
import * as certificate from "@/server/controllers/certificate.controller";

export const GET = handle(certificate.download, ANY_USER);
