// CORS for the few cross-origin calls the frontend makes DIRECTLY to this backend
// (large lesson uploads with an upload-scoped Bearer token). Normal API traffic
// arrives same-origin through the frontend's /api rewrite and needs no CORS.
// Allowed origins: CORS_ORIGIN (comma-separated, e.g. https://ai-spark.vercel.app).
// Credentials (cookies) are never allowed cross-origin.

import { NextResponse, type NextRequest } from "next/server";

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const list = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return list.includes(origin) ? origin : null;
}

export function middleware(req: NextRequest) {
  const origin = allowedOrigin(req.headers.get("origin"));
  const cors: Record<string, string> = origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};
  if (req.method === "OPTIONS") return new NextResponse(null, { status: origin ? 204 : 403, headers: cors });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: ["/api/admin/uploads/:path*", "/api/uploads/:path*"] };
