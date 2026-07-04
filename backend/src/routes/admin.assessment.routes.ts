import { Router } from "express";
import * as a from "../controllers/assessment.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();
router.use(authenticate, requireRole("platform_admin"));

router.post("/", asyncHandler(a.create));
router.get("/module/:moduleId", asyncHandler(a.getForModule));
// Question routes (static prefix) before /:assessmentId.
router.patch("/questions/:questionId", asyncHandler(a.editQuestion));
router.delete("/questions/:questionId", asyncHandler(a.removeQuestion));
router.get("/:assessmentId", asyncHandler(a.getAdmin));
router.patch("/:assessmentId", asyncHandler(a.update));
router.delete("/:assessmentId", asyncHandler(a.remove));
router.post("/:assessmentId/publish", asyncHandler(a.publish));
router.post("/:assessmentId/unpublish", asyncHandler(a.unpublish));
router.post("/:assessmentId/questions/reorder", asyncHandler(a.reorder));
router.post("/:assessmentId/questions", asyncHandler(a.createQuestion));

export default router;
