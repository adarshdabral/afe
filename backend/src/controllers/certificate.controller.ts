// Certificate controllers. Issuance is automatic (progress.service) — the
// student endpoint only re-checks eligibility for an on-demand claim. Verification
// is PUBLIC (students/teachers/anyone); listing all + revoke are platform-admin.

import type { Request, Response } from "express";
import { z } from "zod";
import { toPublicCertificate, Certificate, type CertificateStatus } from "../models/Certificate";
import {
  generateCertificatePdf,
  getByCertificateId,
  getStudentCertificates,
  issueCertificate,
  listAllCertificates,
  revokeCertificate,
} from "../services/certificate.service";
import { getProgress } from "../services/progress.service";

const idSchema = z.string().min(1);

/** GET /api/certificates/mine — the student's certificates. */
export async function mine(req: Request, res: Response): Promise<void> {
  res.json({ data: await getStudentCertificates(req.user!.id) });
}

/**
 * POST /api/certificates/issue — student claims a certificate for a course they
 * have completed. Idempotent; 403 if not yet certificate-eligible. (Certificates
 * are normally auto-issued the moment progress becomes eligible.)
 */
export async function claim(req: Request, res: Response): Promise<void> {
  const { courseId } = z.object({ courseId: z.string().min(1) }).parse(req.body);
  const { progress } = await getProgress(req.user!.id, courseId);
  if (!progress.certificateEligible) {
    res.status(403).json({
      error: { message: "Complete all lessons and pass every assessment to earn your certificate." },
    });
    return;
  }
  const cert = await issueCertificate(req.user!.id, courseId);
  res.status(201).json({ data: cert });
}

/** GET /api/certificates/verify/:certificateId — PUBLIC verification. */
export async function verify(req: Request, res: Response): Promise<void> {
  const certificateId = idSchema.parse(req.params.certificateId);
  const doc = await Certificate.findOne({ certificateId });
  const valid = !!doc && doc.status === "active";
  res.json({
    data: { valid, certificate: doc ? toPublicCertificate(doc) : null },
  });
}

/** GET /api/certificates/:certificateId/download — PDF (owner or platform admin). */
export async function download(req: Request, res: Response): Promise<void> {
  const certificateId = idSchema.parse(req.params.certificateId);
  const cert = await getByCertificateId(certificateId);
  if (!cert) {
    res.status(404).json({ error: { message: "Certificate not found." } });
    return;
  }
  const isOwner = req.user?.id === cert.studentId;
  const isAdmin = req.user?.role === "platform_admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: { message: "Not authorized to download this certificate." } });
    return;
  }
  const bytes = await generateCertificatePdf(cert);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${cert.certificateId}.pdf"`);
  res.send(Buffer.from(bytes));
}

/** GET /api/certificates — list all (platform admin). Optional ?status filter. */
export async function listAll(req: Request, res: Response): Promise<void> {
  const status = z.enum(["active", "revoked"]).optional().parse(req.query.status);
  let certs = await listAllCertificates();
  if (status) certs = certs.filter((c) => c.status === (status as CertificateStatus));
  res.json({ data: certs });
}

/** POST /api/certificates/:certificateId/revoke — platform admin. */
export async function revoke(req: Request, res: Response): Promise<void> {
  const certificateId = idSchema.parse(req.params.certificateId);
  const cert = await revokeCertificate(certificateId);
  if (!cert) {
    res.status(404).json({ error: { message: "Certificate not found." } });
    return;
  }
  res.json({ data: cert });
}
