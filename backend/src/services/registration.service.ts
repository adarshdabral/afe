// Registration service (SRS FR-01 / FR-02) — Mongo-backed port of
// src/lib/auth/registrations.server.ts. The school + teacher directory is a small
// fixed directory kept here as constants; the registration REQUESTS and per-user
// NOTIFICATIONS are persisted (Mongoose) so a teacher sees a student's request
// across sessions. The student User account is created by the controller via
// auth.service.createStudentUser before createRegistration is called.

import {
  RegistrationRequest,
  toRegistrationRequest,
  type RegistrationRequestView,
} from "../models/RegistrationRequest";
import { Notification, toNotification, type NotificationView } from "../models/Notification";
import { User } from "../models/User";
import type { RegistrationStatus } from "../shared/access";
import type { School, TeacherDirectoryEntry } from "../models/School";

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

function nowIso(): string {
  return new Date().toISOString();
}

async function notify(
  userId: string,
  n: { type: NotificationView["type"]; message: string },
): Promise<void> {
  await Notification.create({
    userId,
    type: n.type,
    message: n.message,
    read: false,
    createdAt: nowIso(),
  });
}

export function getDirectory(): { schools: School[]; teachers: TeacherDirectoryEntry[] } {
  return { schools: SCHOOLS, teachers: TEACHERS };
}

export function teacherSchoolIds(teacherUserId: string): string[] {
  return TEACHERS.filter((t) => t.id === teacherUserId).map((t) => t.schoolId);
}

export interface RegisterInput {
  studentUserId: string;
  name: string;
  className: string;
  rollNumber: string;
  schoolId: string;
  teacherId: string;
  email?: string;
  mobile: string;
}

/**
 * FR-01: create the registration request for an already-created (pending) student
 * account and notify the student of the pending status. The student User account
 * is created by the controller via auth.service.createStudentUser.
 */
export async function createRegistration(
  input: RegisterInput,
): Promise<{ request: RegistrationRequestView }> {
  const school = SCHOOLS.find((s) => s.id === input.schoolId);
  if (!school) throw new Error("Please select a valid school.");
  const teacher = TEACHERS.find((t) => t.id === input.teacherId && t.schoolId === input.schoolId);
  if (!teacher) throw new Error("Please select a teacher from your school.");

  const doc = await RegistrationRequest.create({
    studentUserId: input.studentUserId,
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
  });

  await notify(input.studentUserId, {
    type: "registration_pending",
    message: `Your registration was submitted to ${teacher.name} (${school.name}) and is awaiting approval.`,
  });

  return { request: toRegistrationRequest(doc) };
}

async function latestRequestDoc(studentUserId: string) {
  return RegistrationRequest.findOne({ studentUserId }).sort({ requestedAt: -1 });
}

/** The student's most recent request + their notifications. */
export async function getStudentRegistration(
  studentUserId: string,
): Promise<{ request: RegistrationRequestView | null; notifications: NotificationView[] }> {
  const requestDoc = await latestRequestDoc(studentUserId);
  const notifDocs = await Notification.find({ userId: studentUserId }).sort({ createdAt: -1 });
  return {
    request: requestDoc ? toRegistrationRequest(requestDoc) : null,
    notifications: notifDocs.map(toNotification),
  };
}

/** School the student registered under (for certificates), or null if unknown. */
export async function studentSchoolName(studentUserId: string): Promise<string | null> {
  const r = await latestRequestDoc(studentUserId);
  return r?.schoolName ?? null;
}

/** School + class the student registered under (for analytics), or null. */
export async function studentSchoolInfo(
  studentUserId: string,
): Promise<{ schoolId: string; schoolName: string; className: string } | null> {
  const r = await latestRequestDoc(studentUserId);
  return r ? { schoolId: r.schoolId, schoolName: r.schoolName, className: r.className } : null;
}

/** Pending requests visible to a teacher, scoped to the teacher's school(s). */
export async function listPendingForTeacher(
  teacherUserId: string,
): Promise<RegistrationRequestView[]> {
  const schools = teacherSchoolIds(teacherUserId);
  const docs = await RegistrationRequest.find({
    status: "pending",
    schoolId: { $in: schools },
  }).sort({ requestedAt: -1 });
  return docs.map(toRegistrationRequest);
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
}): Promise<RegistrationRequestView> {
  const request = await RegistrationRequest.findById(input.requestId).catch(() => null);
  if (!request) throw new Error("Registration request not found.");
  if (request.status !== "pending") throw new Error("This request has already been decided.");
  if (!teacherSchoolIds(input.teacherUserId).includes(request.schoolId)) {
    throw new Error("You are not authorized to decide this request.");
  }

  request.status = input.decision;
  request.decidedAt = nowIso();
  request.decidedBy = input.teacherUserId;
  request.reason = input.reason;
  await request.save();

  await User.updateOne(
    { _id: request.studentUserId, role: "student" },
    { registrationStatus: input.decision as RegistrationStatus },
  );

  await notify(
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

  return toRegistrationRequest(request);
}
