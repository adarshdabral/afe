import { Router } from "express";
import * as p from "../controllers/progress.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
// Progress is student-owned; every route requires an authenticated student.
router.use(authenticate, requireRole("student"));

router.get("/", asyncHandler(p.mine));
router.get("/:courseId", asyncHandler(p.forCourse));
router.post("/:courseId/lessons/:lessonId/complete", asyncHandler(p.completeLesson));
router.post("/:courseId/visit", asyncHandler(p.visit));
router.post("/:courseId/time", asyncHandler(p.time));

export default router;
