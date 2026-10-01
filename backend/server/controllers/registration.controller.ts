// Registration controllers (SRS FR-01 / FR-02). Student self-registration is
// PUBLIC; the queue + decide endpoints are role-guarded (teacher / platform_admin)
// at the route layer, and ownership is enforced in the service. Role + identity
// come from req.user (the verified JWT), never the client.

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import { createStudentUser, loginIdentifierTaken } from "../services/auth.service";
import {
  createRegistration,
  decideRegistration,
  getDefaultTeacher,
  getTeacherDirectory,
  getStudentRegistration,
  listRegistrations,
} from "../services/registration.service";
import { signToken, cookieOptions, SESSION_COOKIE } from "../utils/jwt";

// Student registration payload (email REQUIRED; schoolName informational; the
// student picks a teacher directly via selectedTeacherId).
const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6),
  mobileNumber: z.string().trim().min(7).max(20),
  schoolName: z.string().trim().min(1).max(160),
});

const decideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(500).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(["all", "pending", "approved", "rejected"]).default("pending"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
});

/** GET /api/registrations/directory — active teachers for the dropdown (PUBLIC). */
export async function directory(_req: Request, res: Response): Promise<void> {
  res.json({ data: await getTeacherDirectory() });
}

/** POST /api/registrations — FR-01 submit a registration + establish a session. */
export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);
  // Auto-assign every new student to the default teacher (no user choice). If it
  // isn't configured, fail gracefully BEFORE creating an orphaned account.
  const teacher = await getDefaultTeacher();
  if (!teacher) {
    res.status(503).json({
      error: {
        message:
          "Registration is temporarily unavailable: the default teacher account is not configured. Please contact support.",
      },
    });
    return;
  }
  if (await loginIdentifierTaken(data.email)) {
    res.status(409).json({
      error: { message: "An account with this email already exists." },
    });
    return;
  }
  const user = await createStudentUser({
    name: data.fullName,
    email: data.email,
    mobile: data.mobileNumber,
    password: data.password,
  });
  await createRegistration({
    studentUserId: user.id,
    studentName: data.fullName,
    schoolName: data.schoolName,
    teacherId: teacher.id,
    teacherName: teacher.name,
    email: data.email,
    mobile: data.mobileNumber,
  });
  const token = signToken({
    sub: user.id,
    role: user.role,
    registrationStatus: user.registrationStatus,
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.status(201).json({ data: user });
}

/** GET /api/registrations/mine — student polls their request status + notifications. */
export async function mine(req: Request, res: Response): Promise<void> {
  const result = await getStudentRegistration(req.user!.id);
  res.json({ data: result });
}

/**
 * GET /api/registrations/queue — FR-02 registration queue.
 *  - teacher        → their assigned requests (ownership enforced in service).
 *  - platform_admin → all requests (full visibility).
 * Query: status (pending|approved|rejected|all), page, pageSize, search.
 */
export async function queue(req: Request, res: Response): Promise<void> {
  const q = listQuerySchema.parse(req.query);
  const result = await listRegistrations({
    actor: { id: req.user!.id, role: req.user!.role },
    status: q.status,
    page: q.page,
    pageSize: q.pageSize,
    search: q.search,
  });
  res.json({ data: result });
}

/** POST /api/registrations/:id/decide — FR-02 approve or reject a request. */
export async function decide(req: Request, res: Response): Promise<void> {
  const data = decideSchema.parse(req.body);
  const requestId = z.string().min(1).parse(req.params.id);
  const result = await decideRegistration({
    requestId,
    actor: { id: req.user!.id, role: req.user!.role },
    decision: data.decision,
    reason: data.reason,
  });
  res.json({ data: result });
}
