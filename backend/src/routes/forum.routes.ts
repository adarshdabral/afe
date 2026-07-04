import { Router } from "express";
import {
  list,
  get,
  create,
  reply,
  moderateThread,
  moderatePost,
} from "../controllers/forum.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/threads", authenticate, asyncHandler(list));
router.get("/threads/:id", authenticate, asyncHandler(get));
router.post("/threads", authenticate, asyncHandler(create));
router.post("/threads/:id/replies", authenticate, asyncHandler(reply));
router.post(
  "/threads/:id/moderate",
  authenticate,
  requireRole("teacher", "platform_admin"),
  asyncHandler(moderateThread),
);
router.post(
  "/posts/:id/moderate",
  authenticate,
  requireRole("teacher", "platform_admin"),
  asyncHandler(moderatePost),
);

export default router;
