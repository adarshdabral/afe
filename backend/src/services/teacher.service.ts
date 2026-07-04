// Teacher-management service — the platform-admin CRUD surface over teacher
// accounts (SRS: only a Platform Admin may create/edit/(de)activate/reset/view/
// search teachers). Teachers never self-register; they log in with the email +
// temporary password generated here. Passwords are hashed with the existing
// PBKDF2 utility; only the plaintext temp password is ever returned to the admin
// (once, at creation / reset), never persisted.

import { User, type UserDoc } from "../models/User";
import { hashPassword } from "../utils/password";
import { generateTemporaryPassword } from "../utils/tempPassword";

export interface TeacherView {
  id: string;
  name: string;
  email: string;
  mobile: string;
  designation: string;
  organization: string;
  specialization: string;
  bio: string;
  profilePhoto: string;
  active: boolean;
  createdAt: string;
}

/** Optional teacher profile fields (shared by create + update). */
export interface TeacherProfileInput {
  mobile?: string;
  designation?: string;
  organization?: string;
  specialization?: string;
  bio?: string;
  profilePhoto?: string;
}

export interface Credentials {
  loginId: string;
  temporaryPassword: string;
}

export type TeacherStatusFilter = "all" | "active" | "inactive";

export interface ListTeachersInput {
  page: number;
  pageSize: number;
  search?: string;
  status: TeacherStatusFilter;
}

export interface ListTeachersResult {
  teachers: TeacherView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function toTeacherView(doc: UserDoc): TeacherView {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email ?? "",
    mobile: doc.mobile ?? "",
    designation: doc.designation ?? "",
    organization: doc.organization ?? "",
    specialization: doc.specialization ?? "",
    bio: doc.bio ?? "",
    profilePhoto: doc.profilePhoto ?? "",
    active: doc.active !== false,
    createdAt:
      (doc as { createdAt?: Date }).createdAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

/** Escape user input before using it in a RegExp (prevents ReDoS / injection). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if a login identifier is taken by a *different* account. */
export async function emailTaken(email: string, excludeId?: string): Promise<boolean> {
  const needle = email.trim().toLowerCase();
  const query: Record<string, unknown> = { identifiers: needle };
  if (excludeId) query._id = { $ne: excludeId };
  return !!(await User.findOne(query));
}

/**
 * Create a teacher: generate a temporary password, hash + store it, and return
 * the account view together with the plaintext credentials for the admin to hand
 * over. Email is the login identifier; mobile/designation are profile fields.
 */
export async function createTeacher(
  input: { name: string; email: string } & TeacherProfileInput,
): Promise<{ teacher: TeacherView; credentials: Credentials }> {
  const email = input.email.trim().toLowerCase();
  const temporaryPassword = generateTemporaryPassword();
  const doc = await User.create({
    role: "teacher",
    name: input.name.trim(),
    email,
    mobile: input.mobile?.trim() ?? "",
    designation: input.designation?.trim() ?? "",
    organization: input.organization?.trim() ?? "",
    specialization: input.specialization?.trim() ?? "",
    bio: input.bio?.trim() ?? "",
    profilePhoto: input.profilePhoto?.trim() ?? "",
    passwordHash: await hashPassword(temporaryPassword),
    active: true,
    identifiers: [email],
  });
  return { teacher: toTeacherView(doc), credentials: { loginId: email, temporaryPassword } };
}

/** Paginated + searchable + status-filtered teacher listing (newest first). */
export async function listTeachers(input: ListTeachersInput): Promise<ListTeachersResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));

  const filter: Record<string, unknown> = { role: "teacher" };
  if (input.status === "active") filter.active = { $ne: false };
  else if (input.status === "inactive") filter.active = false;

  const search = input.search?.trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: rx },
      { email: rx },
      { mobile: rx },
      { designation: rx },
      { organization: rx },
      { specialization: rx },
    ];
  }

  const total = await User.countDocuments(filter);
  const docs = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);

  return {
    teachers: docs.map(toTeacherView),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Fetch a single teacher, or null if the id isn't a teacher account. */
export async function getTeacher(id: string): Promise<TeacherView | null> {
  const doc = await User.findOne({ _id: id, role: "teacher" }).catch(() => null);
  return doc ? toTeacherView(doc) : null;
}

/** Edit a teacher's profile. Changing email re-points the login identifier. */
export async function updateTeacher(
  id: string,
  patch: { name?: string; email?: string } & TeacherProfileInput,
): Promise<TeacherView | null> {
  const doc = await User.findOne({ _id: id, role: "teacher" }).catch(() => null);
  if (!doc) return null;
  if (patch.name !== undefined) doc.name = patch.name.trim();
  if (patch.email !== undefined) {
    doc.email = patch.email.trim().toLowerCase();
    doc.identifiers = [doc.email]; // email is the sole login identifier
  }
  if (patch.mobile !== undefined) doc.mobile = patch.mobile.trim();
  if (patch.designation !== undefined) doc.designation = patch.designation.trim();
  if (patch.organization !== undefined) doc.organization = patch.organization.trim();
  if (patch.specialization !== undefined) doc.specialization = patch.specialization.trim();
  if (patch.bio !== undefined) doc.bio = patch.bio.trim();
  if (patch.profilePhoto !== undefined) doc.profilePhoto = patch.profilePhoto.trim();
  await doc.save();
  return toTeacherView(doc);
}

/** Activate / deactivate a teacher (a deactivated teacher cannot log in). */
export async function setTeacherActive(
  id: string,
  active: boolean,
): Promise<TeacherView | null> {
  const doc = await User.findOne({ _id: id, role: "teacher" }).catch(() => null);
  if (!doc) return null;
  doc.active = active;
  await doc.save();
  return toTeacherView(doc);
}

/** Issue a fresh temporary password for a teacher; return it once to the admin. */
export async function resetTeacherPassword(
  id: string,
): Promise<{ teacher: TeacherView; credentials: Credentials } | null> {
  const doc = await User.findOne({ _id: id, role: "teacher" }).catch(() => null);
  if (!doc) return null;
  const temporaryPassword = generateTemporaryPassword();
  doc.passwordHash = await hashPassword(temporaryPassword);
  await doc.save();
  return {
    teacher: toTeacherView(doc),
    credentials: { loginId: doc.email ?? "", temporaryPassword },
  };
}
