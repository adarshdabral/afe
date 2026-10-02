// /api/admin/tts — narrate lesson text (Cloudflare Workers AI). Synthesis of long
// lessons can take a while, so allow up to 5 minutes.
import { handle, ADMIN } from "@/server/http/handle";
import * as upload from "@/server/controllers/upload.controller";

export const maxDuration = 300;
export const POST = handle(upload.tts, ADMIN);
