// SERVER-ONLY user store. This is the seam to a real database (SRS §6/§7:
// PostgreSQL `users` + role-profile tables). Today it is an in-memory store so
// the four login flows + student registration work end-to-end; swap the Map
// for DB queries and the rest of the auth system is unchanged.
//
// Seed passwords live only in this server module and are env-overridable. They
// are hashed once at first use (PBKDF2) so the verify path exercised at login
// is exactly the production path — credentials are never compared in plaintext.

import { hashPassword, verifyPassword } from "./session.server";
import type { Role, RegistrationStatus, SessionPrincipal } from "./access";

interface SeedUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  username: string;
  password: string;
  registrationStatus?: RegistrationStatus;
}

const seedUsers: SeedUser[] = [
  {
    id: "u-student",
    role: "student",
    name: "Aarav Singh",
    email: "student@afe.edu",
    username: "aarav",
    password: process.env.SEED_STUDENT_PASSWORD ?? "Student@123",
    registrationStatus: "approved", // pre-approved demo student
  },
  {
    id: "u-teacher",
    role: "teacher",
    name: "Dr. Priya Sharma",
    email: "teacher@afe.edu",
    username: "priya",
    password: process.env.SEED_TEACHER_PASSWORD ?? "Teacher@123",
  },
  {
    id: "u-school-admin",
    role: "school_admin",
    name: "Doon Public School Admin",
    email: "school@afe.edu",
    username: "schooladmin",
    password: process.env.SEED_SCHOOL_ADMIN_PASSWORD ?? "School@123",
  },
  {
    id: "u-platform-admin",
    role: "platform_admin",
    name: "Platform Administrator",
    email: "admin@afe.edu",
    username: "admin",
    password: process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? "Admin@123",
  },
];

interface StoredUser {
  principal: SessionPrincipal;
  passwordHash: string;
  /** Login identifiers (lower-cased): email, username, mobile. */
  identifiers: string[];
}

let storePromise: Promise<Map<string, StoredUser>> | null = null;
let dummyHashPromise: Promise<string> | null = null;

/** A real (valid-format) hash compared against when the login is unknown. */
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("invalid-account-placeholder");
  return dummyHashPromise;
}

function principalOf(u: SeedUser): SessionPrincipal {
  const p: SessionPrincipal = { id: u.id, role: u.role, name: u.name, email: u.email };
  if (u.role === "student") p.registrationStatus = u.registrationStatus ?? "pending";
  return p;
}

function getStore(): Promise<Map<string, StoredUser>> {
  if (!storePromise) {
    storePromise = (async () => {
      const map = new Map<string, StoredUser>();
      for (const u of seedUsers) {
        map.set(u.id, {
          principal: principalOf(u),
          passwordHash: await hashPassword(u.password),
          identifiers: [u.email, u.username].map((s) => s.toLowerCase()),
        });
      }
      return map;
    })();
  }
  return storePromise;
}

function lookupByLogin(store: Map<string, StoredUser>, login: string) {
  const needle = login.trim().toLowerCase();
  for (const entry of store.values()) {
    if (entry.identifiers.includes(needle)) return entry;
  }
  return undefined;
}

/**
 * Verify credentials. Returns the session principal on success, or null.
 * Always runs a hash comparison (even for unknown logins) to avoid leaking
 * which accounts exist via response timing.
 */
export async function authenticate(
  login: string,
  password: string,
): Promise<SessionPrincipal | null> {
  const store = await getStore();
  const found = lookupByLogin(store, login);
  const hashToCheck = found?.passwordHash ?? (await dummyHash());
  const ok = await verifyPassword(password, hashToCheck);
  return ok && found ? found.principal : null;
}

/** Re-fetch the principal from the store (used to validate an existing session). */
export async function getUserById(id: string): Promise<SessionPrincipal | null> {
  const store = await getStore();
  return store.get(id)?.principal ?? null;
}

/** True if any account already uses this email / mobile / username (lower-cased). */
export async function loginIdentifierTaken(identifier: string): Promise<boolean> {
  const store = await getStore();
  return !!lookupByLogin(store, identifier);
}

/**
 * Create a student account (FR-01). Starts as `pending`; the teacher-approval
 * workflow flips the status. Returns the session principal.
 */
export async function createStudentUser(input: {
  name: string;
  email?: string;
  mobile: string;
  password: string;
}): Promise<SessionPrincipal> {
  const store = await getStore();
  const id = `stu-${crypto.randomUUID()}`;
  const principal: SessionPrincipal = {
    id,
    role: "student",
    name: input.name,
    email: input.email ?? "",
    registrationStatus: "pending",
  };
  const identifiers = [input.email, input.mobile]
    .filter((s): s is string => !!s)
    .map((s) => s.toLowerCase());
  store.set(id, {
    principal,
    passwordHash: await hashPassword(input.password),
    identifiers,
  });
  return principal;
}

/** Apply a teacher's decision to the student's account (FR-02). */
export async function setRegistrationStatus(
  studentId: string,
  status: RegistrationStatus,
): Promise<void> {
  const store = await getStore();
  const entry = store.get(studentId);
  if (entry && entry.principal.role === "student") {
    entry.principal.registrationStatus = status;
  }
}

export type { Role };
