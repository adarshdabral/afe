// RegistrationRequest model (SRS FR-01 / FR-02) — Mongo-backed replacement for the
// in-memory `requests` map in src/lib/auth/registrations.server.ts. One row per
// student registration submission; a teacher (scoped by school) approves/rejects.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { RegistrationStatus } from "../shared/access";

export interface RegistrationRequestView {
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

const registrationRequestSchema = new Schema(
  {
    studentUserId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    className: { type: String, required: true },
    rollNumber: { type: String, required: true },
    schoolId: { type: String, required: true, index: true },
    schoolName: { type: String, required: true },
    teacherId: { type: String, required: true },
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
    className: doc.className,
    rollNumber: doc.rollNumber,
    schoolId: doc.schoolId,
    schoolName: doc.schoolName,
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
