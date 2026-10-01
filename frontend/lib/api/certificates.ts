// Frontend certificate service — Axios calls to the certificate API (backend app, via the /api rewrite).
// Mirrors backend/server/services/certificate.service.ts.

import { api, API_BASE_URL } from "./axios";

export type CertificateStatus = "active" | "revoked";

export interface Certificate {
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

export interface PublicCertificate {
  certificateId: string;
  studentName: string;
  schoolName: string;
  courseTitle: string;
  issueDate: string;
  status: CertificateStatus;
}

/** The signed-in student's certificates. */
export async function myCertificates(): Promise<Certificate[]> {
  const { data } = await api.get<{ data: Certificate[] }>("/certificates/mine");
  return data.data;
}

/** Claim a certificate for a completed course (idempotent; 403 if not eligible). */
export async function claimCertificate(courseId: string): Promise<Certificate> {
  const { data } = await api.post<{ data: Certificate }>("/certificates/issue", { courseId });
  return data.data;
}

/** PUBLIC verification by certificate id. */
export async function verifyCertificate(
  certificateId: string,
): Promise<{ valid: boolean; certificate: PublicCertificate | null }> {
  const { data } = await api.get<{ data: { valid: boolean; certificate: PublicCertificate | null } }>(
    `/certificates/verify/${encodeURIComponent(certificateId)}`,
  );
  return data.data;
}

/** Admin: all certificates (optionally filtered by status). */
export async function listAllCertificates(status?: CertificateStatus): Promise<Certificate[]> {
  const { data } = await api.get<{ data: Certificate[] }>("/certificates", {
    params: status ? { status } : undefined,
  });
  return data.data;
}

/** Admin: revoke a certificate. */
export async function revokeCertificate(certificateId: string): Promise<Certificate> {
  const { data } = await api.post<{ data: Certificate }>(
    `/certificates/${encodeURIComponent(certificateId)}/revoke`,
  );
  return data.data;
}

/** Absolute URL for the certificate PDF download (auth cookie sent by the browser). */
export function certificateDownloadUrl(certificateId: string): string {
  return `${API_BASE_URL}/certificates/${encodeURIComponent(certificateId)}/download`;
}
