import { Router } from "express";
import { login, register, me, logout } from "../controllers/auth.controller";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/register", asyncHandler(register));
router.get("/me", optionalAuthenticate, asyncHandler(me));
router.post("/logout", authenticate, asyncHandler(logout));

export default router;
