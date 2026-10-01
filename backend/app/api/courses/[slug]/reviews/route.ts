// /api/courses/[slug]/reviews — auth, RBAC and error mapping via handle() in server/http/handle.ts.
import { handle, ANY_USER, OPTIONAL_USER } from "@/server/http/handle";
import * as review from "@/server/controllers/review.controller";

export const GET = handle(review.list, { ...OPTIONAL_USER, params: { slug: "courseId" } });
export const POST = handle(review.add, { ...ANY_USER, params: { slug: "courseId" } });
