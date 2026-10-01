// Upload routes — platform-admin only (documents/images at `/`, videos at `/video`).
// multer parses one `file` field, then the
// controller responds with its URL. multer errors (size/type) flow to the central
// error handler in index.ts.

import { Router } from "express";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { upload, uploadVideo } from "../utils/storage";
import { uploadFile } from "../controllers/upload.controller";

const router = Router();

router.use(authenticate, requireRole("platform_admin"));
router.post("/", upload.single("file"), asyncHandler(uploadFile));
// Lesson videos (MP4/WebM/MOV) — same response shape, larger size cap.
router.post("/video", uploadVideo.single("file"), asyncHandler(uploadFile));

export default router;
