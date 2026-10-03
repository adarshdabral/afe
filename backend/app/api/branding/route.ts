// /api/branding — public platform branding (logo). Auth/errors via handle().
import { handle } from "@/server/http/handle";
import * as branding from "@/server/controllers/branding.controller";

export const GET = handle(branding.get);
