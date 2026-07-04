// RegistrationRequest model (SRS FR-01 / FR-02) — one row per student
// registration submission. A student self-registers, picks a teacher directly
// (selectedTeacherId), and that teacher approves/rejects. There is NO School
// entity: `schoolName` is free-text informational data only.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { RegistrationStatus } from "../shared/access";

export interface RegistrationRequestView {
  id: string;
  studentUserId: string;
  studentName: string;
  schoolName: string; // informational text only
  teacherId: string; // the auto-assigned default teacher's user id
  teacherName: string;
  email: string;
  mobile: string;
  status: RegistrationStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}

const registrationRequestSchema = new Schema(
  {
    studentUserId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    schoolName: { type: String, default: "" }, // informational only — no School entity
    teacherId: { type: String, required: true, index: true }, // auto-assigned default teacher
    teacherName: { type: String, required: true },
    email: { type: String, default: "" },
    mobile: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], required: true },
    requestedAt: { type: String, required: true },
    decidedAt: { type: String },
    decidedBy: { type: String },
    reason: { type: String },
  },
  { timestamps: true },
);

export type RegistrationRequestSchemaType = InferSchemaType<typeof registrationRequestSchema>;
export type RegistrationRequestDoc = HydratedDocument<RegistrationRequestSchemaType>;

export const RegistrationRequest = model("RegistrationRequest", registrationRequestSchema);

/** Project a stored registration request to the API view. */
export function toRegistrationRequest(doc: RegistrationRequestDoc): RegistrationRequestView {
  const view: RegistrationRequestView = {
    id: String(doc._id),
    studentUserId: doc.studentUserId,
    studentName: doc.studentName,
    schoolName: doc.schoolName ?? "",
    teacherId: doc.teacherId,
    teacherName: doc.teacherName,
    email: doc.email ?? "",
    mobile: doc.mobile,
    status: doc.status as RegistrationStatus,
    requestedAt: doc.requestedAt,
  };
  if (doc.decidedAt) view.decidedAt = doc.decidedAt;
  if (doc.decidedBy) view.decidedBy = doc.decidedBy;
  if (doc.reason != null) view.reason = doc.reason;
  return view;
}
