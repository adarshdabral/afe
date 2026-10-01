// Seed the demo accounts (student, teacher, platform admin). SELF-HEALING: on
// every run it upserts the canonical credentials/identifiers/active flag so a
// seed account can always log in — even if it previously drifted (e.g. a changed
// username whose `identifiers` weren't updated, or a stale password hash). This
// is why "seeded accounts cannot log in" cannot recur silently.

import { User } from "../models/User";
import { hashPassword } from "../utils/password";
import type { Role, RegistrationStatus } from "../shared/access";

/**
 * Seed password from the environment, falling back to the documented default when
 * the variable is unset OR blank. (Hosts like Render can create a variable with an
 * empty value; `??` alone would then set the account's password to "" and the
 * documented credentials would never work.)
 */
function seedPassword(envKey: string, fallback: string): string {
  const v = process.env[envKey]?.trim();
  return v ? v : fallback;
}

interface SeedUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  username: string;
  password: string;
  registrationStatus?: RegistrationStatus;
}

// Stable ids line up with the analytics demo cohort (`u-student`) and the teacher
// directory (`u-teacher`). Log in with the email OR the username + password.
const seedUsers: SeedUser[] = [
  {
    id: "u-student",
    role: "student",
    name: "Aarav Singh",
    email: "student@afe.edu",
    username: "aarav",
    password: seedPassword("SEED_STUDENT_PASSWORD", "Student@123"),
    registrationStatus: "approved",
  },
  {
    id: "u-teacher",
    role: "teacher",
    name: "Dr Sudhanshu Joshi",
    email: "teacher@afe.edu",
    username: "dsj",
    password: seedPassword("SEED_TEACHER_PASSWORD", "Teacher@123"),
  },
  {
    id: "u-platform-admin",
    role: "platform_admin",
    name: "Dr Sudhanshu Joshi",
    email: "admin@afe.edu",
    username: "Moocs@admin",
    password: seedPassword("SEED_PLATFORM_ADMIN_PASSWORD", "Admin@123"),
  },
];

export async function seedDemoUsers(): Promise<void> {
  for (const u of seedUsers) {
    // Canonical identifiers = lowercased email + username (login lookup keys).
    const identifiers = [u.email, u.username].map((s) => s.toLowerCase());
    const passwordHash = await hashPassword(u.password);
    // Upsert by stable id so the account is repaired to its canonical state on
    // every startup (fixes drifted identifiers / passwords / active flags).
    await User.updateOne(
      { _id: u.id },
      {
        $set: {
          role: u.role,
          name: u.name,
          email: u.email,
          username: u.username,
          passwordHash,
          identifiers,
          active: true,
          registrationStatus: u.role === "student" ? (u.registrationStatus ?? "approved") : undefined,
        },
      },
      { upsert: true },
    );
  }
}
