import { Router } from "express";
import * as a from "../controllers/assessment.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Viewing a published assessment is allowed for any authenticated user; only
// students may attempt (progress is student-scoped).
router.get("/:assessmentId", authenticate, asyncHandler(a.getStudent));
router.post("/:assessmentId/attempt", authenticate, requireRole("student"), asyncHandler(a.attempt));
router.get("/:assessmentId/attempts", authenticate, requireRole("student"), asyncHandler(a.myAttempts));

export default router;
