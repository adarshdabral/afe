import { Router } from "express";
import {
  claim,
  download,
  listAll,
  mine,
  revoke,
  verify,
} from "../controllers/certificate.controller";
import { authenticate, requireRole } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// PUBLIC — anyone (students, teachers, employers) can verify a certificate.
router.get("/verify/:certificateId", asyncHandler(verify));

// Student
router.get("/mine", authenticate, requireRole("student"), asyncHandler(mine));
router.post("/issue", authenticate, requireRole("student"), asyncHandler(claim));

// Platform admin — view all + revoke
router.get("/", authenticate, requireRole("platform_admin"), asyncHandler(listAll));
router.post("/:certificateId/revoke", authenticate, requireRole("platform_admin"), asyncHandler(revoke));

// Download PDF — owner (student) or platform admin (checked in the handler).
router.get("/:certificateId/download", authenticate, asyncHandler(download));

export default router;
