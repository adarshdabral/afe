// `handle()` turns a controller into a Next.js Route Handler. It replaces the
// Express stack the API used to run on, preserving its behaviour exactly:
//   - authenticate / optionalAuthenticate (JWT from the afe_session cookie or an
//     `Authorization: Bearer` header) → 401 "Not authenticated." /
//     "Invalid or expired session."
//   - requireRole(...)                  → 403 "Not authorized."
//   - JSON body parsing (invalid JSON → 400), multipart uploads streamed to disk
//   - the central error handler: ZodError → 400, errors with a numeric
//     `statusCode` → that status, anything else → 500
// Every handler first awaits ensureServerReady() (DB connection + startup seeds).
//
// Usage in app/api/**/route.ts:
//   export const GET = handle(course.getTree, ADMIN);

import { NextResponse, type NextRequest } from "next/server";
import { ensureServerReady } from "../bootstrap";
import { SESSION_COOKIE, verifyToken } from "../utils/jwt";
import { receiveUpload, type UploadKind } from "../utils/storage";
import type { Role } from "../shared/access";
import type { ApiRequest, ApiResponse, AuthUser, CookieOptions } from "./types";

export type Controller = (req: ApiRequest, res: ApiResponse) => Promise<void> | void;

export interface HandleOptions {
  /** "required" → 401 without a valid session; "optional" → attach user if present. */
  auth?: "required" | "optional";
  /** Allowed roles (implies auth: "required"). */
  roles?: Role[];
  /** Accept a multipart upload in the `file` field, exposed as `req.file`. */
  upload?: UploadKind;
  /** Rename route params for the controller (e.g. { slug: "courseId" }). */
  params?: Record<string, string>;
  /** Allow cross-origin calls from CORS_ORIGIN (direct uploads from the frontend).
   *  Pair with `export const OPTIONS = preflight;` in the route file. Never with cookies. */
  cors?: boolean;
}

/** Common option sets. */
export const ANY_USER: HandleOptions = { auth: "required" };
export const OPTIONAL_USER: HandleOptions = { auth: "optional" };
export const ADMIN: HandleOptions = { roles: ["platform_admin"] };
export const STUDENT: HandleOptions = { roles: ["student"] };
export const STAFF: HandleOptions = { roles: ["teacher", "platform_admin"] };
export const roles = (...r: Role[]): HandleOptions => ({ roles: r });

type RouteContext = { params: Promise<Record<string, string | string[]>> };

// CORS lives here (not in middleware.ts) on purpose: Next.js buffers — and truncates
// at 10 MB — any request body that passes through middleware, which broke large
// video uploads.
function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const list = (process.env.CORS_ORIGIN?.trim() || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedOrigin(request.headers.get("origin"));
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};
}

/** CORS preflight for routes created with `cors: true` (export as OPTIONS). */
export function preflight(request: Request): Response {
  const headers = corsHeaders(request);
  return new Response(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
}

// API responses are per-user: never let a CDN/proxy (e.g. the frontend's /api
// rewrite on Vercel) cache them.
const NO_STORE = { "Cache-Control": "no-store" };
const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: NO_STORE });

function readToken(req: NextRequest): string | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) return cookie;
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

function principal(token: string, allowUploadScope: boolean): AuthUser {
  const payload = verifyToken(token);
  // Upload-scoped tokens are only valid on the upload endpoints.
  if (payload.scope === "upload" && !allowUploadScope) throw new Error("token scope");
  return { id: payload.sub, role: payload.role, registrationStatus: payload.registrationStatus };
}

/** Express-compatible response builder: collects status/headers/cookies/body. */
class ResponseBuilder implements ApiResponse {
  private code = 200;
  private headers = new Headers();
  private body: BodyInit | null = null;
  private cookies: { name: string; value: string; options: CookieOptions; clear?: boolean }[] = [];
  sent = false;

  status(code: number) {
    this.code = code;
    return this;
  }
  json(body: unknown) {
    this.headers.set("content-type", "application/json; charset=utf-8");
    if (!this.headers.has("cache-control")) this.headers.set("cache-control", "no-store");
    this.body = JSON.stringify(body);
    this.sent = true;
  }
  send(body: Uint8Array | string) {
    this.body = typeof body === "string" ? body : new Blob([body as Uint8Array<ArrayBuffer>]);
    this.sent = true;
  }
  setHeader(name: string, value: string) {
    this.headers.set(name, value);
  }
  cookie(name: string, value: string, options: CookieOptions = {}) {
    this.cookies.push({ name, value, options });
  }
  clearCookie(name: string, options: CookieOptions = {}) {
    this.cookies.push({ name, value: "", options, clear: true });
  }
  toResponse(): NextResponse {
    const res = new NextResponse(this.body, { status: this.code, headers: this.headers });
    for (const c of this.cookies) {
      res.cookies.set(c.name, c.value, {
        httpOnly: c.options.httpOnly,
        sameSite: c.options.sameSite,
        secure: c.options.secure,
        path: c.options.path ?? "/",
        // Express maxAge is milliseconds; cookies use seconds. Clearing expires now.
        ...(c.clear ? { expires: new Date(0) } : c.options.maxAge !== undefined ? { maxAge: Math.floor(c.options.maxAge / 1000) } : {}),
      });
    }
    return res;
  }
}

function toErrorResponse(err: unknown): NextResponse {
  const e = err as { name?: string; message?: string; issues?: unknown; statusCode?: number };
  if (e?.name === "ZodError") return json(400, { error: { message: "Invalid request.", issues: e.issues } });
  if (typeof e?.statusCode === "number") return json(e.statusCode, { error: { message: e.message ?? "Request failed." } });
  console.error("[api] unhandled error:", err);
  return json(500, { error: { message: e?.message ?? "Internal server error." } });
}

export function handle(controller: Controller, options: HandleOptions = {}) {
  const auth = options.roles ? "required" : options.auth;

  return async function routeHandler(request: NextRequest, context: RouteContext): Promise<Response> {
    const response = await run(request, context);
    if (options.cors) for (const [k, v] of Object.entries(corsHeaders(request))) response.headers.set(k, v);
    return response;
  };

  async function run(request: NextRequest, context: RouteContext): Promise<Response> {
    try {
      await ensureServerReady();

      // --- authentication / authorization (before reading the body, like Express) ---
      let user: AuthUser | undefined;
      const token = readToken(request);
      if (auth === "required") {
        if (!token) return json(401, { error: { message: "Not authenticated." } });
        try {
          user = principal(token, !!options.upload);
        } catch {
          return json(401, { error: { message: "Invalid or expired session." } });
        }
      } else if (auth === "optional" && token) {
        try {
          user = principal(token, !!options.upload);
        } catch {
          /* treated as unauthenticated */
        }
      }
      if (options.roles && (!user || !options.roles.includes(user.role))) {
        return json(403, { error: { message: "Not authorized." } });
      }

      // --- params / query ---
      const raw = (await context.params) ?? {};
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        params[options.params?.[k] ?? k] = Array.isArray(v) ? v.join("/") : v;
      }
      const query: Record<string, string> = {};
      request.nextUrl.searchParams.forEach((v, k) => (query[k] = v));

      // --- body ---
      let body: unknown = {};
      let file: ApiRequest["file"];
      if (options.upload) {
        file = await receiveUpload(request, options.upload);
      } else if ((request.headers.get("content-type") ?? "").includes("application/json")) {
        const text = await request.text();
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            return json(400, { error: { message: "Malformed JSON body." } });
          }
        }
      }

      const req: ApiRequest = { body, params, query, headers: request.headers, user, file };
      const res = new ResponseBuilder();
      await controller(req, res);
      if (!res.sent) res.status(204);
      return res.toResponse();
    } catch (err) {
      return toErrorResponse(err);
    }
  }
}
