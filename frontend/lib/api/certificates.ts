// Frontend certificate service — replaces the TanStack certificate.functions.ts
// callables (issueCertificateFn / myCertificateFn / verifyCertificateFn) with
// Axios calls to the Express API.

import { api } from "./axios";

export interface Certificate {
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

export interface PublicCertificate {
  certificateCode: string;
  studentName: string;
  schoolName: string;
  courseTitle: string;
  issuedAt: string;
}

export interface IssueInput {
  completedLessons: Record<string, boolean>;
  assessmentScores: Record<string, { scorePct: number; passed: boolean }>;
}

/** FR-11 idempotent issue once eligible. Throws if not yet eligible. */
export async function issueCertificate(input: IssueInput): Promise<Certificate> {
  const { data } = await api.post<{ data: Certificate }>("/certificates/issue", input);
  return data.data;
}

/** The signed-in student's certificate for the AI course, or null. */
export async function myCertificate(): Promise<Certificate | null> {
  const { data } = await api.get<{ data: Certificate | null }>("/certificates/mine");
  return data.data;
}

/** PUBLIC verification by the opaque token embedded in the QR. */
export async function verifyCertificate(
  token: string,
): Promise<{ valid: boolean; certificate: PublicCertificate | null }> {
  const { data } = await api.get<{ data: { valid: boolean; certificate: PublicCertificate | null } }>(
    `/certificates/verify/${encodeURIComponent(token)}`,
  );
  return data.data;
}
