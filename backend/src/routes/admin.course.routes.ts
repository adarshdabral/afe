import { Router } from "express";
import * as course from "../controllers/course.controller";
import * as moduleCtl from "../controllers/module.controller";
import * as lesson from "../controllers/lesson.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// RBAC: the entire admin CMS is platform-admin-only (router-level guard).
router.use(authenticate, requireRole("platform_admin"));

// --- Courses ---
router.post("/", asyncHandler(course.create));
router.get("/", asyncHandler(course.list));

// --- Modules / Lessons keyed by their own id (static prefixes come first) ---
router.patch("/modules/:moduleId", asyncHandler(moduleCtl.update));
router.delete("/modules/:moduleId", asyncHandler(moduleCtl.remove));
router.post("/modules/:moduleId/lessons", asyncHandler(lesson.create));
router.post("/modules/:moduleId/lessons/reorder", asyncHandler(lesson.reorder));
router.patch("/lessons/:lessonId", asyncHandler(lesson.update));
router.delete("/lessons/:lessonId", asyncHandler(lesson.remove));

// --- Course sub-resources + single-course ops ---
router.post("/:courseId/modules/reorder", asyncHandler(moduleCtl.reorder));
router.post("/:courseId/modules", asyncHandler(moduleCtl.create));
router.post("/:courseId/publish", asyncHandler(course.publish));
router.post("/:courseId/unpublish", asyncHandler(course.unpublish));
router.post("/:courseId/archive", asyncHandler(course.archive));
router.get("/:courseId", asyncHandler(course.getTree));
router.patch("/:courseId", asyncHandler(course.update));
router.delete("/:courseId", asyncHandler(course.remove));

export default router;
