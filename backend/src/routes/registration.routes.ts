import { Router } from "express";
import { directory, register, mine, queue, decide } from "../controllers/registration.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/directory", asyncHandler(directory)); // PUBLIC — teacher dropdown
router.post("/", asyncHandler(register)); // PUBLIC — student self-registration
router.get("/mine", authenticate, requireRole("student"), asyncHandler(mine));
// Queue: teacher sees own assigned requests; platform_admin sees all (enforced in service).
router.get("/queue", authenticate, requireRole("teacher", "platform_admin"), asyncHandler(queue));
router.post(
  "/:id/decide",
  authenticate,
  requireRole("teacher", "platform_admin"),
  asyncHandler(decide),
);

export default router;
