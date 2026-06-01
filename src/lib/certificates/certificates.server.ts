// SERVER-ONLY certificate store (SRS FR-11). Certificates are issued once a
// learner completes all modules and passes every assessment, carry a unique
// code + an opaque verification token (behind the QR), and snapshot the
// student/school/course so the record stays valid even if profiles change.
// In-memory today — the DB seam for the future `certificates` table.

export interface Certificate {
  id: string;
  certificateCode: string; // human-readable unique id, e.g. AFE-CERT-9F2A-2026
  verificationToken: string; // opaque, used in the QR / verify URL
  studentUserId: string;
  studentName: string;
  schoolName: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  status: "valid" | "revoked";
}

const byStudentCourse = new Map<string, Certificate>(); // key: `${studentUserId}:${courseId}`
const byToken = new Map<string, Certificate>();

const key = (studentUserId: string, courseId: string) => `${studentUserId}:${courseId}`;

export interface IssueInput {
  studentUserId: string;
  studentName: string;
  schoolName: string;
  courseId: string;
  courseTitle: string;
}

/** Idempotent: one certificate per (student, course). Returns the existing one if present. */
export function issueCertificate(input: IssueInput): Certificate {
  const existing = byStudentCourse.get(key(input.studentUserId, input.courseId));
  if (existing) return existing;

  const year = new Date().getFullYear();
  const cert: Certificate = {
    id: crypto.randomUUID(),
    certificateCode: `AFE-CERT-${crypto.randomUUID().slice(0, 4).toUpperCase()}-${year}`,
    verificationToken: crypto.randomUUID(),
    studentUserId: input.studentUserId,
    studentName: input.studentName,
    schoolName: input.schoolName,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    issuedAt: new Date().toISOString(),
    status: "valid",
  };
  byStudentCourse.set(key(input.studentUserId, input.courseId), cert);
  byToken.set(cert.verificationToken, cert);
  return cert;
}

export function getCertificate(studentUserId: string, courseId: string): Certificate | null {
  return byStudentCourse.get(key(studentUserId, courseId)) ?? null;
}

export function getCertificateByToken(token: string): Certificate | null {
  return byToken.get(token) ?? null;
}
