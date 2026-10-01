import { Router } from "express";
import * as course from "../controllers/course.controller";
import { optionalAuthenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Public, role-scoped reads. optionalAuthenticate resolves req.user when a session
// is present so the service can widen visibility for platform admins; anonymous
// and student/teacher callers see published courses only.
router.get("/", optionalAuthenticate, asyncHandler(course.publicList));
router.get("/:slug/lessons/:lessonId", optionalAuthenticate, asyncHandler(course.publicGetLesson));
router.get("/:slug", optionalAuthenticate, asyncHandler(course.publicGetBySlug));

export default router;
