// SERVER-ONLY registration store (FR-01 / FR-02). Holds the school + teacher
// directory used for "Teacher Selection", the registration requests, and the
// per-user notification feed. In-memory today (the DB seam — maps onto the
// `schools`, `teachers`, `registration_requests`, `notifications` tables); the
// shared server-side store is what lets a teacher see a student's request
// across sessions (client localStorage cannot).

import { createStudentUser, loginIdentifierTaken, setRegistrationStatus } from "./users.server";
import type { RegistrationStatus, SessionPrincipal } from "./access";

export interface School {
  id: string;
  name: string;
}

export interface TeacherDirectoryEntry {
  id: string; // matches a users.server user id so the teacher can log in to approve
  name: string;
  schoolId: string;
}

// The directory. Entries reference the seeded teacher account `u-teacher`
// (Dr. Priya Sharma) — the approver who can actually log in. Approval is scoped
// by school, so any teacher of a school sees that school's pending requests
// regardless of which teacher the student selected.
export const SCHOOLS: School[] = [
  { id: "school-1", name: "Doon Public School" },
  { id: "school-2", name: "St. Joseph's Academy" },
];

export const TEACHERS: TeacherDirectoryEntry[] = [
  { id: "u-teacher", name: "Dr. Priya Sharma", schoolId: "school-1" },
  { id: "u-teacher", name: "Dr. Priya Sharma", schoolId: "school-2" },
];

export interface RegistrationRequest {
  id: string;
  studentUserId: string;
  studentName: string;
  className: string;
  rollNumber: string;
  schoolId: string;
  schoolName: string;
  teacherId: string;
  teacherName: string;
  email: string;
  mobile: string;
  status: RegistrationStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}

export interface Notification {
  id: string;
  type: "registration_pending" | "registration_approved" | "registration_rejected";
  message: string;
  createdAt: string;
  read: boolean;
}

const requests = new Map<string, RegistrationRequest>();
const notifications = new Map<string, Notification[]>();

function nowIso() {
  return new Date().toISOString();
}

function notify(userId: string, n: Omit<Notification, "id" | "createdAt" | "read">) {
  const list = notifications.get(userId) ?? [];
  list.unshift({ id: `ntf-${crypto.randomUUID()}`, createdAt: nowIso(), read: false, ...n });
  notifications.set(userId, list);
}

export function getDirectory() {
  return { schools: SCHOOLS, teachers: TEACHERS };
}

export function teacherSchoolIds(teacherUserId: string): string[] {
  return TEACHERS.filter((t) => t.id === teacherUserId).map((t) => t.schoolId);
}

export interface RegisterInput {
  name: string;
  className: string;
  rollNumber: string;
  schoolId: string;
  teacherId: string;
  email?: string;
  mobile: string;
  password: string;
}

/**
 * FR-01: create the student account (pending) + the registration request and
 * notify the student of the pending status. Returns the new session principal
 * so the caller can establish a session.
 */
export async function createRegistration(
  input: RegisterInput,
): Promise<{ principal: SessionPrincipal; request: RegistrationRequest }> {
  const school = SCHOOLS.find((s) => s.id === input.schoolId);
  if (!school) throw new Error("Please select a valid school.");
  const teacher = TEACHERS.find((t) => t.id === input.teacherId && t.schoolId === input.schoolId);
  if (!teacher) throw new Error("Please select a teacher from your school.");

  const loginId = input.email || input.mobile;
  if (await loginIdentifierTaken(loginId)) {
    throw new Error("An account with this email or mobile number already exists.");
  }

  const principal = await createStudentUser({
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    password: input.password,
  });

  const request: RegistrationRequest = {
    id: `reg-${crypto.randomUUID()}`,
    studentUserId: principal.id,
    studentName: input.name,
    className: input.className,
    rollNumber: input.rollNumber,
    schoolId: school.id,
    schoolName: school.name,
    teacherId: teacher.id,
    teacherName: teacher.name,
    email: input.email ?? "",
    mobile: input.mobile,
    status: "pending",
    requestedAt: nowIso(),
  };
  requests.set(request.id, request);

  notify(principal.id, {
    type: "registration_pending",
    message: `Your registration was submitted to ${teacher.name} (${school.name}) and is awaiting approval.`,
  });

  return { principal, request };
}

/** The student's most recent request + their notifications. */
export function getStudentRegistration(studentUserId: string) {
  const request = [...requests.values()]
    .filter((r) => r.studentUserId === studentUserId)
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0];
  return { request: request ?? null, notifications: notifications.get(studentUserId) ?? [] };
}

function latestRequest(studentUserId: string) {
  return [...requests.values()]
    .filter((r) => r.studentUserId === studentUserId)
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0];
}

/** School the student registered under (for certificates), or null if unknown. */
export function studentSchoolName(studentUserId: string): string | null {
  return latestRequest(studentUserId)?.schoolName ?? null;
}

/** School + class the student registered under (for analytics), or null. */
export function studentSchoolInfo(
  studentUserId: string,
): { schoolId: string; schoolName: string; className: string } | null {
  const r = latestRequest(studentUserId);
  return r ? { schoolId: r.schoolId, schoolName: r.schoolName, className: r.className } : null;
}

/** Pending requests visible to a teacher, scoped to the teacher's school(s). */
export function listPendingForTeacher(teacherUserId: string): RegistrationRequest[] {
  const schools = new Set(teacherSchoolIds(teacherUserId));
  return [...requests.values()]
    .filter((r) => r.status === "pending" && schools.has(r.schoolId))
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

/**
 * FR-02: a teacher approves or rejects a request. Authorization is enforced by
 * school scope. Updates the student's account status and notifies the student.
 */
export async function decideRegistration(input: {
  requestId: string;
  teacherUserId: string;
  decision: "approved" | "rejected";
  reason?: string;
}): Promise<RegistrationRequest> {
  const request = requests.get(input.requestId);
  if (!request) throw new Error("Registration request not found.");
  if (request.status !== "pending") throw new Error("This request has already been decided.");
  if (!teacherSchoolIds(input.teacherUserId).includes(request.schoolId)) {
    throw new Error("You are not authorized to decide this request.");
  }

  request.status = input.decision;
  request.decidedAt = nowIso();
  request.decidedBy = input.teacherUserId;
  request.reason = input.reason;
  requests.set(request.id, request);

  await setRegistrationStatus(request.studentUserId, input.decision);

  notify(
    request.studentUserId,
    input.decision === "approved"
      ? {
          type: "registration_approved",
          message: `Your registration was approved by ${request.teacherName}. You now have full course access.`,
        }
      : {
          type: "registration_rejected",
          message: `Your registration was rejected${input.reason ? `: ${input.reason}` : "."}`,
        },
  );

  return request;
}
