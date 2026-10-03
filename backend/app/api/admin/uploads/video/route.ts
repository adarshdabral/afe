// /api/admin/uploads/video — local-disk upload (used only when Cloudflare R2 isn't configured;
// with R2 the browser uploads straight to the bucket via /api/admin/uploads/presign).
// Called cross-origin by the frontend with an upload token → CORS + preflight.
import { handle, preflight, ADMIN } from "@/server/http/handle";
import * as upload from "@/server/controllers/upload.controller";
import { VIDEO_UPLOAD } from "@/server/utils/storage";

export const POST = handle(upload.uploadFile, { ...ADMIN, upload: VIDEO_UPLOAD, cors: true });
export const OPTIONS = preflight;
