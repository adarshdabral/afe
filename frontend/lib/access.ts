// Isomorphic RBAC config — the single source of truth for roles + route access,
// identical to backend/src/shared/access.ts (and the original src/lib/auth/access.ts).
// Pure: no server-only imports, no secrets. Consumed by middleware.ts.

export type Role = "student" | "teacher" | "school_admin" | "platform_admin";

/** Student enrollment-approval state (FR-01/FR-02). */
export type RegistrationStatus = "pending" | "approved" | "rejected";

/** Minimal shape the route guard needs. */
export interface SessionPrincipal {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** Only meaningful for students; undefined for staff roles. */
  registrationStatus?: RegistrationStatus;
}

/** The pending/approval landing route for students who aren't yet approved. */
export const STUDENT_PENDING_PATH = "/student/pending";

/** Route-prefix → roles allowed to access it. */
export const ROUTE_ACCESS: ReadonlyArray<{ prefix: string; roles: readonly Role[] }> = [
  { prefix: "/student", roles: ["student"] },
  { prefix: "/instructor", roles: ["teacher", "platform_admin"] },
  { prefix: "/admin", roles: ["school_admin", "platform_admin"] },
];

/** Where each role lands after login / when redirected off an unauthorized route. */
export function roleHome(role: Role): string {
  switch (role) {
    case "student":
      return "/student/dashboard";
    case "teacher":
      return "/instructor/dashboard";
    case "school_admin":
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
    case "school_admin":
      return "School Admin";
    case "platform_admin":
      return "Platform Admin";
  }
}

function matchedRule(pathname: string) {
  return ROUTE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
}

/**
 * Pure access decision used by the route guard (verbatim logic from the TanStack
 * __root.tsx beforeLoad guard).
 *  - public route                → null
 *  - protected + unauthenticated  → "/login"
 *  - protected + wrong role       → that user's own home (no privilege escalation)
 *  - student not yet approved     → "/student/pending" (and approved-on-pending → dashboard)
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
