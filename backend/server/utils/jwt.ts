import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Role, RegistrationStatus } from "../shared/access";

export interface JwtPayload {
  sub: string;
  role: Role;
  registrationStatus?: RegistrationStatus;
  /** "upload" → a short-lived token that may ONLY call the upload endpoints. */
  scope?: "upload";
}

export const SESSION_COOKIE = "afe_session";
const EXPIRES_IN = "7d";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 * 1000; // 7 days (ms)

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: EXPIRES_IN });
}

/** Upload tokens let the browser send large files straight to the backend
 *  (bypassing the frontend's /api proxy) without exposing the session cookie. */
export const UPLOAD_TOKEN_TTL_SECONDS = 15 * 60;
export function signUploadToken(payload: Omit<JwtPayload, "scope">): string {
  return jwt.sign({ ...payload, scope: "upload" }, env.jwtSecret, { expiresIn: UPLOAD_TOKEN_TTL_SECONDS });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

/** httpOnly cookie options mirroring the prior sealed-session cookie. */
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProd,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
