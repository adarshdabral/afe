// Seed the four demo accounts — ported from the seedUsers list in
// src/lib/auth/users.server.ts. Idempotent: skips accounts that already exist.

import { User } from "../models/User";
import { hashPassword } from "../utils/password";
import type { Role, RegistrationStatus } from "../shared/access";

interface SeedUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  username: string;
  password: string;
  registrationStatus?: RegistrationStatus;
}

// Stable ids matching the original store + the registration teacher directory
// (`u-teacher`) and the analytics demo cohort (`u-student`).
const seedUsers: SeedUser[] = [
  {
    id: "u-student",
    role: "student",
    name: "Aarav Singh",
    email: "student@afe.edu",
    username: "aarav",
    password: process.env.SEED_STUDENT_PASSWORD ?? "Student@123",
    registrationStatus: "approved",
  },
  {
    id: "u-teacher",
    role: "teacher",
    name: "Dr Sudhanshu Joshi",
    email: "teacher@afe.edu",
    username: "priya",
    password: process.env.SEED_TEACHER_PASSWORD ?? "Teacher@123",
  },
  {
    id: "u-school-admin",
    role: "school_admin",
    name: "Dr Sudhanshu Joshi",
    email: "school@afe.edu",
    username: "schooladmin",
    password: process.env.SEED_SCHOOL_ADMIN_PASSWORD ?? "School@123",
  },
  {
    id: "u-platform-admin",
    role: "platform_admin",
    name: "Dr Sudhanshu Joshi",
    email: "admin@afe.edu",
    username: "Moocs@admin",
    password: process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? "Admin@123",
  },
];

export async function seedDemoUsers(): Promise<void> {
  for (const u of seedUsers) {
    const identifiers = [u.email, u.username].map((s) => s.toLowerCase());
    const exists = await User.findOne({ identifiers: { $in: identifiers } });
    if (exists) continue;
    await User.create({
      _id: u.id,
      role: u.role,
      name: u.name,
      email: u.email,
      username: u.username,
      passwordHash: await hashPassword(u.password),
      registrationStatus: u.role === "student" ? (u.registrationStatus ?? "pending") : undefined,
      identifiers,
    });
  }
}
