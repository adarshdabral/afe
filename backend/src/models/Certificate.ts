// Certificate model (SRS FR-11) — Mongo-backed replacement for the in-memory
// store in src/lib/certificates/certificates.server.ts. One certificate per
// (student, course); snapshots student/school/course so the record stays valid.

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export interface CertificateView {
  id: string;
  certificateCode: string;
  verificationToken: string;
  studentUserId: string;
  studentName: string;
  schoolName: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  status: "valid" | "revoked";
}

const certificateSchema = new Schema(
  {
    certificateCode: { type: String, required: true, unique: true },
    verificationToken: { type: String, required: true, unique: true, index: true },
    studentUserId: { type: String, required: true },
    studentName: { type: String, required: true },
    schoolName: { type: String, required: true },
    courseId: { type: String, required: true },
    courseTitle: { type: String, required: true },
    issuedAt: { type: String, required: true },
    status: { type: String, enum: ["valid", "revoked"], default: "valid" },
  },
  { timestamps: true },
);

// Idempotency: one certificate per (student, course).
certificateSchema.index({ studentUserId: 1, courseId: 1 }, { unique: true });

export type CertificateSchemaType = InferSchemaType<typeof certificateSchema>;
export type CertificateDoc = HydratedDocument<CertificateSchemaType>;

export const Certificate = model("Certificate", certificateSchema);

/** Project a stored certificate to the API view. */
export function toCertificate(doc: CertificateDoc): CertificateView {
  return {
    id: String(doc._id),
    certificateCode: doc.certificateCode,
    verificationToken: doc.verificationToken,
    studentUserId: doc.studentUserId,
    studentName: doc.studentName,
    schoolName: doc.schoolName,
    courseId: doc.courseId,
    courseTitle: doc.courseTitle,
    issuedAt: doc.issuedAt,
    status: (doc.status as "valid" | "revoked") ?? "valid",
  };
}
