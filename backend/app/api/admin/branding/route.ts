// /api/admin/branding — platform admins set/clear the logo.
import { handle, ADMIN } from "@/server/http/handle";
import * as branding from "@/server/controllers/branding.controller";

export const GET = handle(branding.get, ADMIN);
export const PUT = handle(branding.update, ADMIN);
