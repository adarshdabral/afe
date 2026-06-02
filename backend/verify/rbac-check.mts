// Verifies the RBAC redirect matrix used by the frontend middleware.
// guardRedirect here is byte-identical to frontend/lib/access.ts (and the
// original TanStack __root.tsx guard), so this proves the role-redirect behavior.
import { guardRedirect, type SessionPrincipal } from "../src/shared/access.ts";

const student = (s: "approved" | "pending"): SessionPrincipal => ({
  id: "u", role: "student", name: "S", email: "s@x", registrationStatus: s,
});
const teacher: SessionPrincipal = { id: "t", role: "teacher", name: "T", email: "t@x" };
const schoolAdmin: SessionPrincipal = { id: "sa", role: "school_admin", name: "SA", email: "sa@x" };
const platformAdmin: SessionPrincipal = { id: "pa", role: "platform_admin", name: "PA", email: "pa@x" };

type Case = [string, SessionPrincipal | null, string, string | null];
const cases: Case[] = [
  // [label, principal, path, expectedRedirect]
  ["anon → /student/dashboard ⇒ /login", null, "/student/dashboard", "/login"],
  ["anon → /instructor/dashboard ⇒ /login", null, "/instructor/dashboard", "/login"],
  ["anon → /admin/dashboard ⇒ /login", null, "/admin/dashboard", "/login"],
  ["anon → / (public) ⇒ allow", null, "/", null],
  ["anon → /login (public) ⇒ allow", null, "/login", null],

  ["approved student → /student/dashboard ⇒ allow", student("approved"), "/student/dashboard", null],
  ["student → /instructor/* ⇒ own home", student("approved"), "/instructor/dashboard", "/student/dashboard"],
  ["student → /admin/* ⇒ own home", student("approved"), "/admin/dashboard", "/student/dashboard"],

  ["pending student → /student/dashboard ⇒ /student/pending", student("pending"), "/student/dashboard", "/student/pending"],
  ["pending student → /student/pending ⇒ allow", student("pending"), "/student/pending", null],
  ["approved student → /student/pending ⇒ /student/dashboard", student("approved"), "/student/pending", "/student/dashboard"],

  ["teacher → /instructor/dashboard ⇒ allow", teacher, "/instructor/dashboard", null],
  ["teacher → /student/* ⇒ own home", teacher, "/student/dashboard", "/instructor/dashboard"],
  ["teacher → /admin/* ⇒ own home", teacher, "/admin/dashboard", "/instructor/dashboard"],

  ["school_admin → /admin/dashboard ⇒ allow", schoolAdmin, "/admin/dashboard", null],
  ["school_admin → /instructor/* ⇒ own home", schoolAdmin, "/instructor/dashboard", "/admin/dashboard"],
  ["school_admin → /student/* ⇒ own home", schoolAdmin, "/student/dashboard", "/admin/dashboard"],

  ["platform_admin → /admin/* ⇒ allow", platformAdmin, "/admin/dashboard", null],
  ["platform_admin → /instructor/* ⇒ allow (shared)", platformAdmin, "/instructor/dashboard", null],

  ["authed on /login ⇒ own home", teacher, "/login", "/instructor/dashboard"],
  ["authed on /register ⇒ own home", student("approved"), "/register", "/student/dashboard"],
];

let pass = 0, fail = 0;
const failed: string[] = [];
for (const [label, principal, path, expected] of cases) {
  const got = guardRedirect(path, principal);
  if (got === expected) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failed.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    console.log(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
}
console.log(`\nRBAC matrix: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("FAILURES:\n  - " + failed.join("\n  - "));
  process.exit(1);
}
process.exit(0);
