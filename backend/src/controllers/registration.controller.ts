// Registration controllers (SRS FR-01 / FR-02) — ported handler bodies from
// src/lib/auth/registration.functions.ts. Role + scope come from req.user
// (the verified JWT), never the client.

import type { Request, Response } from "express";
import { z } from "zod";
import { createStudentUser, loginIdentifierTaken } from "../services/auth.service";
import {
  createRegistration,
  decideRegistration,
  getDirectory,
  getStudentRegistration,
  listPendingForTeacher,
} from "../services/registration.service";
import { signToken, cookieOptions, SESSION_COOKIE } from "../utils/jwt";

const registerSchema = z.object({
  name: z.string().min(1),
  className: z.enum(["8", "9", "10", "11", "12"]),
  rollNumber: z.string().min(1),
  schoolId: z.string().min(1),
  teacherId: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  mobile: z.string().min(7).max(20),
  password: z.string().min(6),
});

const decideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(500).optional(),
});

/** GET /api/registrations/directory — schools + teachers (PUBLIC). */
export async function directory(_req: Request, res: Response): Promise<void> {
  res.json({ data: getDirectory() });
}

/** POST /api/registrations — FR-01 submit a school-linked registration + session. */
export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);
  const loginId = data.email || data.mobile;
  if (await loginIdentifierTaken(loginId)) {
    res.status(409).json({
      error: { message: "An account with this email or mobile number already exists." },
    });
    return;
  }
  const user = await createStudentUser({
    name: data.name,
    email: data.email || undefined,
    mobile: data.mobile,
    password: data.password,
  });
  await createRegistration({
    studentUserId: user.id,
    name: data.name,
    className: data.className,
    rollNumber: data.rollNumber,
    schoolId: data.schoolId,
    teacherId: data.teacherId,
    email: data.email || undefined,
    mobile: data.mobile,
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

/** GET /api/registrations/pending — FR-02 pending requests for the teacher's school(s). */
export async function pending(req: Request, res: Response): Promise<void> {
  const result = await listPendingForTeacher(req.user!.id);
  res.json({ data: result });
}

/** POST /api/registrations/:id/decide — FR-02 approve or reject a request. */
export async function decide(req: Request, res: Response): Promise<void> {
  const data = decideSchema.parse(req.body);
  const requestId = z.string().min(1).parse(req.params.id);
  const result = await decideRegistration({
    requestId,
    teacherUserId: req.user!.id,
    decision: data.decision,
    reason: data.reason,
  });
  res.json({ data: result });
}
