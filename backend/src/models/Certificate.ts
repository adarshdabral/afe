// Certificate model. One certificate per (student, course) — auto-issued when the
// student's course progress becomes certificate-eligible. `certificateId` is the
// public, human-readable id (AFE-YYYY-XXXXXXXX); `verificationCode` is a short
// secondary check; `qrCode` holds the public verification URL. Snapshots
// student/school/course so the record stays valid even if those change.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export type CertificateStatus = "active" | "revoked";

export interface CertificateView {
  id: string;
  certificateId: string;
  studentId: string;
  courseId: string;
  studentName: string;
  schoolName: string;
  courseTitle: string;
  issueDate: string;
  verificationCode: string;
  qrCode: string;
  status: CertificateStatus;
}

const certificateSchema = new Schema(
  {
    certificateId: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    schoolName: { type: String, default: "" },
    courseTitle: { type: String, required: true },
    issueDate: { type: String, required: true },
    verificationCode: { type: String, required: true, unique: true, index: true },
    qrCode: { type: String, default: "" }, // public verification URL
    status: { type: String, enum: ["active", "revoked"], default: "active" },
  },
  { timestamps: true },
);

// Idempotency: one certificate per (student, course).
certificateSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export type CertificateSchemaType = InferSchemaType<typeof certificateSchema>;
export type CertificateDoc = HydratedDocument<CertificateSchemaType>;

export const Certificate = model("Certificate", certificateSchema);

export function toCertificate(doc: CertificateDoc): CertificateView {
  return {
    id: String(doc._id),
    certificateId: doc.certificateId,
    studentId: doc.studentId,
    courseId: doc.courseId,
    studentName: doc.studentName,
    schoolName: doc.schoolName ?? "",
    courseTitle: doc.courseTitle,
    issueDate: doc.issueDate,
    verificationCode: doc.verificationCode,
    qrCode: doc.qrCode ?? "",
    status: (doc.status as CertificateStatus) ?? "active",
  };
}

/** Public projection (verification page) — no internal ids. */
export interface PublicCertificate {
  certificateId: string;
  studentName: string;
  schoolName: string;
  courseTitle: string;
  issueDate: string;
  status: CertificateStatus;
}

export function toPublicCertificate(doc: CertificateDoc): PublicCertificate {
  return {
    certificateId: doc.certificateId,
    studentName: doc.studentName,
    schoolName: doc.schoolName ?? "",
    courseTitle: doc.courseTitle,
    issueDate: doc.issueDate,
    status: (doc.status as CertificateStatus) ?? "active",
  };
}
