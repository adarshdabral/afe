// Certificate controllers (SRS FR-11) — ported from src/lib/certificates/
// certificate.functions.ts. Issuance re-validates eligibility server-side with
// the shared progress aggregation. Verification is PUBLIC.

import type { Request, Response } from "express";
import { z } from "zod";
import { buildCourseProgress } from "../lib/progress";
import { AI_COURSE } from "../data/curriculum";
import type { AssessmentResult } from "../data/assessments";
import { issueCertificate, getCertificate, getCertificateByToken } from "../services/certificate.service";
import { getUserById } from "../services/auth.service";
import type { CertificateView } from "../models/Certificate";

export interface PublicCertificate {
  certificateCode: string;
  studentName: string;
  schoolName: string;
  courseTitle: string;
  issuedAt: string;
}

function toPublic(c: CertificateView): PublicCertificate {
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
  assessmentScores: z.record(z.object({ scorePct: z.number(), passed: z.boolean() })),
});

/** POST /api/certificates/issue — FR-11 idempotent issue once eligible. Student only. */
export async function issue(req: Request, res: Response): Promise<void> {
  const data = issueSchema.parse(req.body);
  const user = req.user!;
  const progress = buildCourseProgress({
    completedLessons: data.completedLessons,
    assessmentScores: data.assessmentScores as unknown as Record<string, AssessmentResult>,
    timeSpent: {},
  });
  if (progress.modulesCompleted < progress.modulesTotal) {
    res.status(400).json({
      error: { message: "Complete all modules and pass every assessment to earn your certificate." },
    });
    return;
  }
  // School-name enrichment belongs to the registrations feature (not yet
  // migrated); fall back to the same default the original used.
  const principal = await getUserById(user.id);
  const cert = await issueCertificate({
    studentUserId: user.id,
    studentName: principal?.name ?? "",
    schoolName: "Independent Learner",
    courseId: AI_COURSE.id,
    courseTitle: AI_COURSE.title,
  });
  res.json({ data: cert });
}

/** GET /api/certificates/mine — the student's AI-course certificate, or null. */
export async function mine(req: Request, res: Response): Promise<void> {
  const cert = await getCertificate(req.user!.id, AI_COURSE.id);
  res.json({ data: cert });
}

/** GET /api/certificates/verify/:token — PUBLIC verification by opaque token. */
export async function verify(req: Request, res: Response): Promise<void> {
  const token = z.string().min(1).parse(req.params.token);
  const cert = await getCertificateByToken(token);
  const valid = !!cert && cert.status === "valid";
  res.json({ data: { valid, certificate: cert ? toPublic(cert) : null } });
}
