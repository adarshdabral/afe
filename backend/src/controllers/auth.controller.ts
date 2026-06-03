// Auth controllers — ported handler bodies from src/lib/auth/auth.functions.ts
// (login/logout/me) and the account-creation portion of registration.functions.ts.

import type { Request, Response } from "express";
import { z } from "zod";
import {
  authenticate,
  getUserById,
  createStudentUser,
  createUser,
  loginIdentifierTaken,
} from "../services/auth.service";
import { signToken, cookieOptions, SESSION_COOKIE } from "../utils/jwt";

const loginSchema = z.object({ login: z.string().min(1), password: z.string().min(1) });

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  mobile: z.string().min(7).max(20),
  password: z.string().min(6),
});

const signupSchema = z.object({
  role: z.enum(["student", "teacher", "school_admin", "platform_admin"]),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  username: z.string().min(3).max(40).optional().or(z.literal("")),
  mobile: z.string().min(7).max(20).optional().or(z.literal("")),
  password: z.string().min(6),
});

/** POST /api/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const data = loginSchema.parse(req.body);
  const user = await authenticate(data.login, data.password);
  if (!user) {
    res.status(401).json({ error: { message: "Invalid email or password" } });
    return;
  }
  const token = signToken({ sub: user.id, role: user.role, registrationStatus: user.registrationStatus });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.json({ data: user });
}

/** POST /api/auth/register — creates a pending student account + session. */
export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);
  const loginId = data.email || data.mobile;
  if (await loginIdentifierTaken(loginId)) {
    res.status(409).json({ error: { message: "An account with this email or mobile number already exists." } });
    return;
  }
  const user = await createStudentUser({
    name: data.name,
    email: data.email || undefined,
    mobile: data.mobile,
    password: data.password,
  });
  const token = signToken({ sub: user.id, role: user.role, registrationStatus: user.registrationStatus });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.status(201).json({ data: user });
}

/** POST /api/auth/signup — create an account with a chosen role + session. */
export async function signup(req: Request, res: Response): Promise<void> {
  const data = signupSchema.parse(req.body);
  const loginId = data.email || data.username || data.mobile;
  if (!loginId) {
    res.status(400).json({ error: { message: "Provide an email, username, or mobile number." } });
    return;
  }
  if (await loginIdentifierTaken(loginId)) {
    res
      .status(409)
      .json({ error: { message: "An account with that email, username, or mobile already exists." } });
    return;
  }
  const user = await createUser({
    role: data.role,
    name: data.name,
    email: data.email || undefined,
    username: data.username || undefined,
    mobile: data.mobile || undefined,
    password: data.password,
  });
  const token = signToken({
    sub: user.id,
    role: user.role,
    registrationStatus: user.registrationStatus,
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.status(201).json({ data: user });
}

/** GET /api/auth/me — re-validate the token against the store. */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.json({ data: null });
    return;
  }
  const user = await getUserById(req.user.id);
  res.json({ data: user });
}

/** POST /api/auth/logout */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.json({ data: { ok: true } });
}
