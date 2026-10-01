import { Router } from "express";
import {
  create,
  list,
  get,
  update,
  activate,
  deactivate,
  resetPassword,
} from "../controllers/teacher.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// RBAC: the entire teacher-management surface is platform-admin-only. Applying
// the guard at the router level ensures no endpoint below can be added without it.
router.use(authenticate, requireRole("platform_admin"));

router.get("/", asyncHandler(list));
router.post("/", asyncHandler(create));
router.get("/:id", asyncHandler(get));
router.patch("/:id", asyncHandler(update));
router.post("/:id/activate", asyncHandler(activate));
router.post("/:id/deactivate", asyncHandler(deactivate));
router.post("/:id/reset-password", asyncHandler(resetPassword));

export default router;
