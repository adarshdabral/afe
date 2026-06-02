import { Router } from "express";
import { directory, register, mine, pending, decide } from "../controllers/registration.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/directory", asyncHandler(directory)); // PUBLIC
router.post("/", asyncHandler(register)); // PUBLIC
router.get("/mine", authenticate, requireRole("student"), asyncHandler(mine));
router.get("/pending", authenticate, requireRole("teacher", "platform_admin"), asyncHandler(pending));
router.post(
  "/:id/decide",
  authenticate,
  requireRole("teacher", "platform_admin"),
  asyncHandler(decide),
);

export default router;
