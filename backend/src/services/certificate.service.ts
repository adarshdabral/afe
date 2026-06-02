// Certificate service — Mongo-backed port of src/lib/certificates/
// certificates.server.ts. Issuance is idempotent (one cert per student+course).

import { Certificate, toCertificate, type CertificateView } from "../models/Certificate";

export interface IssueInput {
  studentUserId: string;
  studentName: string;
  schoolName: string;
  courseId: string;
  courseTitle: string;
}

/** Idempotent: returns the existing certificate if present, else mints one. */
export async function issueCertificate(input: IssueInput): Promise<CertificateView> {
  const existing = await Certificate.findOne({
    studentUserId: input.studentUserId,
    courseId: input.courseId,
  });
  if (existing) return toCertificate(existing);

  const year = new Date().getFullYear();
  const doc = await Certificate.create({
    certificateCode: `AFE-CERT-${crypto.randomUUID().slice(0, 4).toUpperCase()}-${year}`,
    verificationToken: crypto.randomUUID(),
    studentUserId: input.studentUserId,
    studentName: input.studentName,
    schoolName: input.schoolName,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    issuedAt: new Date().toISOString(),
    status: "valid",
  });
  return toCertificate(doc);
}

export async function getCertificate(
  studentUserId: string,
  courseId: string,
): Promise<CertificateView | null> {
  const doc = await Certificate.findOne({ studentUserId, courseId });
  return doc ? toCertificate(doc) : null;
}

export async function getCertificateByToken(token: string): Promise<CertificateView | null> {
  const doc = await Certificate.findOne({ verificationToken: token });
  return doc ? toCertificate(doc) : null;
}
