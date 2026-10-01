// Auth controllers — login / register (student self-registration) / me / logout.
// Teacher accounts are NOT created here: they are provisioned by a platform admin
// through the teacher-management resource (`/api/admin/teachers`). Teachers may
// log in only while active (enforced in `login`).

import type { ApiRequest as Request, ApiResponse as Response } from "../http/types";
import { z } from "zod";
import {
  authenticate,
  getUserById,
  createStudentUser,
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

/** POST /api/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const data = loginSchema.parse(req.body);
  const user = await authenticate(data.login, data.password);
  if (!user) {
    res.status(401).json({ error: { message: "Invalid email or password" } });
    return;
  }
  // Teachers may sign in only while active (credentials verified above, so this
  // is an authorization decision, not a credential leak).
  if (user.role === "teacher" && user.active === false) {
    res.status(403).json({ error: { message: "This teacher account has been deactivated." } });
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
