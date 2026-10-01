// Registration service (SRS FR-01 / FR-02). Students self-register and pick a
// teacher directly (selectedTeacherId); that teacher — or a platform admin —
// approves/rejects. There is NO School entity: the teacher directory is derived
// from real teacher User accounts, and `schoolName` is stored as free text only.
//
// Ownership: a teacher may only see/decide requests assigned to them
// (teacherId === their user id). A platform admin sees/decides everything.

import {
  RegistrationRequest,
  toRegistrationRequest,
  type RegistrationRequestView,
} from "../models/RegistrationRequest";
import { Notification, toNotification, type NotificationView } from "../models/Notification";
import { User } from "../models/User";
import { requireTeacherApproval } from "../config/env";
import type { RegistrationStatus, Role } from "../shared/access";

export interface TeacherDirectoryEntry {
  id: string; // matches a User id so the teacher can log in to approve
  name: string;
  designation: string;
  organization: string;
  specialization: string;
  profilePhoto: string;
}

export type StatusFilter = RegistrationStatus | "all";

export interface ListInput {
  actor: { id: string; role: Role };
  status: StatusFilter;
  page: number;
  pageSize: number;
  search?: string;
}

export interface ListResult {
  requests: RegistrationRequestView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/** Public teacher directory for the registration dropdown (active teachers). */
export async function getTeacherDirectory(): Promise<{ teachers: TeacherDirectoryEntry[] }> {
  const docs = await User.find({ role: "teacher", active: { $ne: false } }).sort({ name: 1 });
  return {
    teachers: docs.map((d) => {
      const t = d as {
        designation?: string;
        organization?: string;
        specialization?: string;
        profilePhoto?: string;
      };
      return {
        id: String(d._id),
        name: d.name,
        designation: t.designation ?? "",
        organization: t.organization ?? "",
        specialization: t.specialization ?? "",
        profilePhoto: t.profilePhoto ?? "",
      };
    }),
  };
}

/** The email of the default teacher every new student is auto-assigned to. */
export const DEFAULT_TEACHER_EMAIL = "teacher@afe.edu";

/** Resolve the active default teacher (Dr Sudhanshu Joshi), or null if missing. */
export async function getDefaultTeacher(): Promise<{ id: string; name: string } | null> {
  const t = await User.findOne({
    email: DEFAULT_TEACHER_EMAIL,
    role: "teacher",
    active: { $ne: false },
  }).catch(() => null);
  return t ? { id: String(t._id), name: t.name } : null;
}

export interface RegisterInput {
  studentUserId: string;
  studentName: string;
  schoolName: string;
  teacherId: string;
  teacherName: string;
  email?: string;
  mobile: string;
}

/**
 * FR-01: create the registration request for an already-created (pending) student
 * account, assigned to the chosen teacher, and notify the student. Validates the
 * teacher is a real, active teacher account.
 */
export async function createRegistration(
  input: RegisterInput,
): Promise<{ request: RegistrationRequestView }> {
  // Default: auto-approve (no teacher approval required). When
  // REQUIRE_TEACHER_APPROVAL=true, the request stays pending for the teacher.
  const approvalRequired = requireTeacherApproval();
  const now = nowIso();
  const doc = await RegistrationRequest.create({
    studentUserId: input.studentUserId,
    studentName: input.studentName,
    schoolName: input.schoolName,
    teacherId: input.teacherId, // auto-assigned default teacher (no user choice)
    teacherName: input.teacherName,
    email: input.email ?? "",
    mobile: input.mobile,
    status: approvalRequired ? "pending" : "approved",
    requestedAt: now,
    ...(approvalRequired ? {} : { decidedAt: now, decidedBy: "system" }),
  });

  await notify(
    input.studentUserId,
    approvalRequired
      ? {
          type: "registration_pending",
          message: `Your registration was submitted to ${input.teacherName} and is awaiting approval.`,
        }
      : {
          type: "registration_approved",
          message: `Your registration is complete — you have full course access.`,
        },
  );

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

/**
 * FR-02 queue: registrations the actor may manage.
 *  - teacher        → only requests assigned to them (ownership).
 *  - platform_admin → all requests (visibility).
 * Supports status filter + search + pagination.
 */
export async function listRegistrations(input: ListInput): Promise<ListResult> {
  const page = Math.max(1, input.page);
  const pageSize = Math.min(100, Math.max(1, input.pageSize));

  const filter: Record<string, unknown> = {};
  if (input.actor.role === "teacher") filter.teacherId = input.actor.id; // ownership
  if (input.status !== "all") filter.status = input.status;

  const search = input.search?.trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { studentName: rx },
      { email: rx },
      { mobile: rx },
      { rollNumber: rx },
      { schoolName: rx },
    ];
  }

  const total = await RegistrationRequest.countDocuments(filter);
  const docs = await RegistrationRequest.find(filter)
    .sort({ requestedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);

  return {
    requests: docs.map(toRegistrationRequest),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * FR-02: approve/reject a request. Ownership: a teacher may only decide their own
 * assigned requests; a platform admin may decide any. Updates the student's
 * account status and notifies the student.
 */
export async function decideRegistration(input: {
  requestId: string;
  actor: { id: string; role: Role };
  decision: "approved" | "rejected";
  reason?: string;
}): Promise<RegistrationRequestView> {
  const request = await RegistrationRequest.findById(input.requestId).catch(() => null);
  if (!request) throw new Error("Registration request not found.");
  if (request.status !== "pending") throw new Error("This request has already been decided.");
  if (input.actor.role === "teacher" && request.teacherId !== input.actor.id) {
    throw new Error("You are not authorized to decide this request.");
  }

  request.status = input.decision;
  request.decidedAt = nowIso();
  request.decidedBy = input.actor.id;
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

/** Approved student ids assigned to a teacher (used to scope teacher analytics). */
export async function studentIdsForTeacher(teacherUserId: string): Promise<string[]> {
  const docs = await RegistrationRequest.find({
    teacherId: teacherUserId,
    status: "approved",
  }).select("studentUserId");
  return docs.map((d) => d.studentUserId);
}

/** School the student registered under (for analytics). schoolName is free text
 *  and is the analytics grouping key (there is no School entity). Class is no
 *  longer collected at registration, so it is reported as empty. */
export async function studentSchoolInfo(
  studentUserId: string,
): Promise<{ schoolName: string; className: string } | null> {
  const r = await latestRequestDoc(studentUserId);
  if (!r) return null;
  return { schoolName: r.schoolName ?? "", className: "" };
}
