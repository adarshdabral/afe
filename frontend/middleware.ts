// Frontend RBAC guard — mirrors the original TanStack __root.tsx `beforeLoad`
// gate. It validates the session against the API (`GET /api/auth/me`,
// the same auth service the app uses) and applies the canonical `guardRedirect`
// decision. This is the UX layer; the backend API remains the real authority
// (every protected route handler enforces auth/roles via backend/server/http/handle.ts).

import { NextResponse, type NextRequest } from "next/server";
import { guardRedirect, type SessionPrincipal } from "@/lib/access";
import { BACKEND_URL } from "@/lib/backend";

// The session is validated against the backend directly (server-to-server, the
// cookie forwarded in the header) — not via the /api rewrite.
const API_BASE = `${BACKEND_URL}/api`;

/** Only run the (network-backed) guard for the protected prefixes + auth screens. */
function isGuarded(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/student") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/instructor") ||
    pathname.startsWith("/admin")
  );
}

/** Resolve + re-validate the session via the auth API (mirrors getCurrentUserFn). */
async function resolvePrincipal(req: NextRequest): Promise<SessionPrincipal | null> {
  const cookie = req.headers.get("cookie") ?? "";
  if (!cookie.includes("afe_session=")) return null; // no session cookie → anonymous
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { cookie },
      cache: "no-store",
      // A sleeping backend (e.g. Render free tier) must not hang navigation.
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: SessionPrincipal | null };
    return json.data ?? null;
  } catch {
    return null; // API unreachable → treat as anonymous (fail closed for protected routes)
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isGuarded(pathname)) return NextResponse.next();

  const principal = await resolvePrincipal(req);
  const to = guardRedirect(pathname, principal);

  if (to && to !== pathname) {
    const url = req.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/student/:path*",
    "/learn/:path*",
    "/instructor/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
