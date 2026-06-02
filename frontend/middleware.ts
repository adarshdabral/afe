// Frontend RBAC guard — mirrors the original TanStack __root.tsx `beforeLoad`
// gate. It validates the session against the Express API (`GET /api/auth/me`,
// the same auth service the app uses) and applies the canonical `guardRedirect`
// decision. This is the UX layer; the Express API remains the real authority
// (every protected endpoint is still enforced by `authenticate`/`requireRole`).

import { NextResponse, type NextRequest } from "next/server";
import { guardRedirect, type SessionPrincipal } from "@/lib/access";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

/** Only run the (network-backed) guard for the protected prefixes + auth screens. */
function isGuarded(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/student") ||
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
  matcher: ["/student/:path*", "/instructor/:path*", "/admin/:path*", "/login", "/register"],
};
