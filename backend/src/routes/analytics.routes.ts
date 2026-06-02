import { Router } from "express";
import { sync, teacher, school, platform } from "../controllers/analytics.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/progress", authenticate, requireRole("student"), asyncHandler(sync));
router.get("/teacher", authenticate, requireRole("teacher", "platform_admin"), asyncHandler(teacher));
router.get(
  "/school",
  authenticate,
  requireRole("school_admin", "platform_admin"),
  asyncHandler(school),
);
router.get("/platform", authenticate, requireRole("platform_admin"), asyncHandler(platform));

export default router;
