// Minimal role helpers for the client (subset of the isomorphic access.ts).

import type { Role } from "@/lib/api/auth";

export type { Role };

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
