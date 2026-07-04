// Auth service — Mongo-backed port of src/lib/auth/users.server.ts. Preserves the
// timing-safe "always hash, even for unknown logins" behaviour so response
// timing doesn't leak which accounts exist.

import { User, principalOf } from "../models/User";
import { hashPassword, verifyPassword } from "../utils/password";
import { requireTeacherApproval } from "../config/env";
import type { SessionPrincipal } from "../shared/access";

let dummyHashPromise: Promise<string> | null = null;

/** A real (valid-format) hash compared against when the login is unknown. */
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("invalid-account-placeholder");
  return dummyHashPromise;
}

/** Verify credentials. Returns the session principal on success, or null. */
export async function authenticate(
  login: string,
  password: string,
): Promise<SessionPrincipal | null> {
  const needle = login.trim().toLowerCase();
  const doc = await User.findOne({ identifiers: needle });
  const hashToCheck = doc?.passwordHash ?? (await dummyHash());
  const ok = await verifyPassword(password, hashToCheck);
  return ok && doc ? principalOf(doc) : null;
}

/** Re-fetch the principal from the store (used to validate an existing token). */
export async function getUserById(id: string): Promise<SessionPrincipal | null> {
  const doc = await User.findById(id).catch(() => null);
  return doc ? principalOf(doc) : null;
}

/** True if any account already uses this email / mobile / username (lower-cased). */
export async function loginIdentifierTaken(identifier: string): Promise<boolean> {
  const doc = await User.findOne({ identifiers: identifier.trim().toLowerCase() });
  return !!doc;
}

/**
 * Create a student account (FR-01, account portion only). Starts as `pending`.
 * The school/teacher registration-request workflow belongs to the registrations
 * feature and is out of scope for the auth migration.
 */
export async function createStudentUser(input: {
  name: string;
  email?: string;
  mobile: string;
  password: string;
}): Promise<SessionPrincipal> {
  const identifiers = [input.email, input.mobile]
    .filter((s): s is string => !!s)
    .map((s) => s.toLowerCase());
  // Default: students are approved immediately. Only when teacher approval is
  // required (REQUIRE_TEACHER_APPROVAL=true) do they start as pending.
  const doc = await User.create({
    role: "student",
    name: input.name,
    email: input.email ?? "",
    mobile: input.mobile,
    passwordHash: await hashPassword(input.password),
    registrationStatus: requireTeacherApproval() ? "pending" : "approved",
    identifiers,
  });
  return principalOf(doc);
}
