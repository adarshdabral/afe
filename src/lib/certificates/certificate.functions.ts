// Certificate RPC surface (SRS FR-11). Issuance re-validates eligibility
// server-side with the shared progress aggregation, so a certificate is only
// minted once all modules are complete and every assessment is passed.
// Verification is PUBLIC (no session) so anyone scanning the QR can check it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Request-scoped server utility, not a React hook (alias avoids the lint).
import { useAppSession as resolveSession } from "@/lib/auth/session.server";
import type { CurrentUser } from "@/lib/auth/auth.functions";
import type { Role } from "@/lib/auth/access";
import { studentSchoolName } from "@/lib/auth/registrations.server";
import { buildCourseProgress } from "@/lib/progress";
import { AI_COURSE } from "@/data/curriculum";
import type { AssessmentResult } from "@/data/assessments";
import {
  getCertificate,
  getCertificateByToken,
  issueCertificate,
  type Certificate,
} from "./certificates.server";

async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = (await resolveSession()).data.user;
  if (!user) throw new Error("Not authenticated.");
  if (roles && !roles.includes(user.role)) throw new Error("Not authorized.");
  return user;
}

/** Public-facing view shown on the verification page (no internal ids). */
export interface PublicCertificate {
  certificateCode: string;
  studentName: string;
  schoolName: string;
  courseTitle: string;
  issuedAt: string;
}

function toPublic(c: Certificate): PublicCertificate {
  return {
    certificateCode: c.certificateCode,
    studentName: c.studentName,
    schoolName: c.schoolName,
    courseTitle: c.courseTitle,
    issuedAt: c.issuedAt,
  };
}

const issueSchema = z.object({
  completedLessons: z.record(z.boolean()),
  // Only the fields eligibility needs; extra keys are stripped by zod.
  assessmentScores: z.record(z.object({ scorePct: z.number(), passed: z.boolean() })),
});

/** FR-11 auto-generation: idempotent issue once eligibility is re-validated. */
export const issueCertificateFn = createServerFn({ method: "POST" })
  .inputValidator(issueSchema)
  .handler(async ({ data }): Promise<Certificate> => {
    const user = await requireUser(["student"]);
    const progress = buildCourseProgress({
      completedLessons: data.completedLessons,
      assessmentScores: data.assessmentScores as unknown as Record<string, AssessmentResult>,
      timeSpent: {},
    });
    if (progress.modulesCompleted < progress.modulesTotal) {
      throw new Error("Complete all modules and pass every assessment to earn your certificate.");
    }
    return issueCertificate({
      studentUserId: user.id,
      studentName: user.name,
      schoolName: studentSchoolName(user.id) ?? "Independent Learner",
      courseId: AI_COURSE.id,
      courseTitle: AI_COURSE.title,
    });
  });

/** The signed-in student's certificate for the AI course, or null. */
export const myCertificateFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Certificate | null> => {
    const user = await requireUser(["student"]);
    return getCertificate(user.id, AI_COURSE.id);
  },
);

/** PUBLIC verification by the opaque token embedded in the QR. */
export const verifyCertificateFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ valid: boolean; certificate: PublicCertificate | null }> => {
    const cert = getCertificateByToken(data.token);
    const valid = !!cert && cert.status === "valid";
    return { valid, certificate: cert ? toPublic(cert) : null };
  });
