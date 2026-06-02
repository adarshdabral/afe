import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, verifyToken } from "../utils/jwt";
import type { Role } from "../shared/access";

/** Read the JWT from the session cookie or an `Authorization: Bearer` header. */
function readToken(req: Request): string | null {
  const cookie = req.cookies?.[SESSION_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

/** Verify the JWT and attach the principal to `req.user`. 401 if missing/invalid. */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: { message: "Not authenticated." } });
    return;
  }
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      registrationStatus: payload.registrationStatus,
    };
    next();
  } catch {
    res.status(401).json({ error: { message: "Invalid or expired session." } });
  }
}

/** Attach `req.user` if a valid token is present; otherwise continue (no 401). */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = {
        id: payload.sub,
        role: payload.role,
        registrationStatus: payload.registrationStatus,
      };
    } catch {
      /* ignore — treated as unauthenticated */
    }
  }
  next();
}

/** Restrict to the given roles (mirrors the `requireRole` helper + ROUTE_ACCESS). */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: { message: "Not authorized." } });
      return;
    }
    next();
  };
}
