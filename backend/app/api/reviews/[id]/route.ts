// /api/reviews/[id] — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER } from "@/server/http/handle";
import * as review from "@/server/controllers/review.controller";

export const PUT = handle(review.edit, ANY_USER);
export const DELETE = handle(review.remove, ANY_USER);
