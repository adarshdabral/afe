// Isomorphic RBAC config — the single source of truth for roles + route access.
// KEEP IN SYNC with frontend/lib/access.ts (identical logic; the frontend uses it
// in middleware.ts, the backend for the API's role types). Pure: no server-only
// imports, no secrets.
//
// Role model is exactly three roles: students self-register (and start pending),
// teachers are provisioned by a platform admin (and log in only while active),
// and platform admins are seeded with full access.

export type Role = "student" | "teacher" | "platform_admin";

/** Student enrollment-approval state (FR-01/FR-02). */
export type RegistrationStatus = "pending" | "approved" | "rejected";

// Teachers never self-register — a platform admin provisions them via the
// teacher-management resource (/api/admin/teachers). `platform_admin` accounts
// are bootstrap-only (seeded). Only `student` self-registers.

/** Minimal shape the route guard needs. */
export interface SessionPrincipal {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** Only meaningful for students; undefined for staff roles. */
  registrationStatus?: RegistrationStatus;
  /** Only meaningful for teachers; whether the account may sign in. */
  active?: boolean;
}

/** The pending/approval landing route for students who aren't yet approved. */
export const STUDENT_PENDING_PATH = "/student/pending";

/**
 * Route-prefix → roles allowed to access it. Platform admins have full access
 * (they appear on every protected surface).
 */
export const ROUTE_ACCESS: ReadonlyArray<{ prefix: string; roles: readonly Role[] }> = [
  { prefix: "/student", roles: ["student"] },
  { prefix: "/learn", roles: ["student", "teacher", "platform_admin"] },
  { prefix: "/instructor", roles: ["teacher", "platform_admin"] },
  { prefix: "/admin", roles: ["platform_admin"] },
];

/** Where each role lands after login / when redirected off an unauthorized route. */
export function roleHome(role: Role): string {
  switch (role) {
    case "student":
      return "/student/dashboard";
    case "teacher":
      return "/instructor/dashboard";
    case "platform_admin":
      return "/admin/dashboard";
  }
}

/** Human label for a role (used in sidebars / badges). */
export function roleLabel(role: Role): string {
  switch (role) {
    case "student":
      return "Student";
    case "teacher":
      return "Teacher";
    case "platform_admin":
      return "Platform Admin";
  }
}

function matchedRule(pathname: string) {
  return ROUTE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
}

/**
 * Pure access decision used by the route guard.
 *  - public route                → null
 *  - protected + unauthenticated  → "/login"
 *  - protected + wrong role       → that user's own home (no privilege escalation)
 */
export function guardRedirect(pathname: string, principal: SessionPrincipal | null): string | null {
  if (principal && (pathname === "/login" || pathname === "/register")) {
    return roleHome(principal.role);
  }

  const rule = matchedRule(pathname);
  if (!rule) return null; // public
  if (!principal) return "/login"; // must sign in
  if (!rule.roles.includes(principal.role)) return roleHome(principal.role); // wrong role

  if (principal.role === "student") {
    const onPending = pathname === STUDENT_PENDING_PATH;
    const approved = principal.registrationStatus === "approved";
    if (!approved && !onPending) return STUDENT_PENDING_PATH;
    if (approved && onPending) return "/student/dashboard";
  }
  return null; // authorized
}
