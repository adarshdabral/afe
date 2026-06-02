import { Router } from "express";
import { issue, mine, verify } from "../controllers/certificate.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/issue", authenticate, requireRole("student"), asyncHandler(issue));
router.get("/mine", authenticate, requireRole("student"), asyncHandler(mine));
router.get("/verify/:token", asyncHandler(verify)); // PUBLIC

export default router;
