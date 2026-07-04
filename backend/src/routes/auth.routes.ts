import { Router } from "express";
import { login, register, me, logout } from "../controllers/auth.controller";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/login", asyncHandler(login));
// Student self-registration → creates a PENDING student account (FR-01).
// Teachers are provisioned by a platform admin via /api/admin/teachers.
router.post("/register", asyncHandler(register));
router.get("/me", optionalAuthenticate, asyncHandler(me));
router.post("/logout", authenticate, asyncHandler(logout));

export default router;
