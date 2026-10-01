import { Router } from "express";
import { list, add, edit, remove } from "../controllers/review.controller";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Course-scoped: list (public; viewer's own review attached when signed in) + add.
router.get("/courses/:courseId/reviews", optionalAuthenticate, asyncHandler(list));
router.post("/courses/:courseId/reviews", authenticate, asyncHandler(add));

// Review-scoped: edit / delete own review (ownership enforced in the service).
router.put("/reviews/:id", authenticate, asyncHandler(edit));
router.delete("/reviews/:id", authenticate, asyncHandler(remove));

export default router;
