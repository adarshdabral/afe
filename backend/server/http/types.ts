// Framework-neutral request/response contract for controllers. Route Handlers
// (app/api/**/route.ts) build these via `handle()` in ./handle.ts, so the
// controllers keep a tiny, Express-like surface without depending on Express.

import type { Role, RegistrationStatus } from "../shared/access";

export interface AuthUser {
  id: string;
  role: Role;
  registrationStatus?: RegistrationStatus;
}

export interface UploadedFile {
  /** Stored (random) filename inside UPLOAD_DIR. */
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
}

export interface ApiRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  headers: Headers;
  user?: AuthUser;
  file?: UploadedFile;
}

export interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  path?: string;
  /** Milliseconds (Express convention). */
  maxAge?: number;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  send(body: Uint8Array | string): void;
  setHeader(name: string, value: string): void;
  cookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string, options?: CookieOptions): void;
}
